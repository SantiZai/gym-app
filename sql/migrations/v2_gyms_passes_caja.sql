-- MIGRACIÓN v2 Pases Caja: historial preservado + filtros por fecha.
-- Todo idempotente. Ejecutar en SQL Editor después de v2_gyms_passes.sql.
--
-- Reglas:
-- 1) Sacar/borrar un miembro del gym NO borra sus pagos (gym_pass_payments
--    cuelga de users/manual_clients, no de gym_members; manage_gym_member
--    solo toca gym_members/gym_trainers/users.gym_id).
-- 2) Borrar un cliente manual NO borra su historial: el FK pasa a SET NULL
--    y queda client_name como snapshot para la pestaña Caja.
-- 3) Borrar una cuenta de usuario tampoco borra caja: FK a SET NULL con snapshot.
-- 4) Los pagos SOLO se eliminan a mano desde Caja (delete_gym_pass_payment).
-- 5) Asegura pass_default_amount por si se corrió la versión vieja del archivo base.

-- 0) Monto por defecto (por si la base vino de la versión anterior) -----------
ALTER TABLE public.gyms
ADD COLUMN IF NOT EXISTS pass_default_amount numeric DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gyms_pass_amount_check') THEN
    ALTER TABLE public.gyms
    ADD CONSTRAINT gyms_pass_amount_check CHECK (pass_default_amount IS NULL OR pass_default_amount >= 0);
  END IF;
END $$;

-- 1) Snapshot de nombre para ex-miembros / manuales borrados ------------------
ALTER TABLE public.gym_pass_payments
ADD COLUMN IF NOT EXISTS client_name text;

-- Backfill: manuales existentes
UPDATE public.gym_pass_payments p
SET client_name = mc.name
FROM public.gym_manual_clients mc
WHERE p.manual_client_id = mc.id AND p.client_name IS NULL;

-- Backfill: usuarios existentes
UPDATE public.gym_pass_payments p
SET client_name = u.name
FROM public.users u
WHERE p.user_id = u.id AND p.client_name IS NULL;

-- 2) FKs a SET NULL (preservar caja) ------------------------------------------
DO $$
DECLARE
  v_con text;
BEGIN
  -- manual_client_id: CASCADE -> SET NULL
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.gym_pass_payments'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE '%manual_client_id%'
  LIMIT 1;
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.gym_pass_payments DROP CONSTRAINT %I', v_con);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.gym_pass_payments'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%manual_client_id%SET NULL%'
  ) THEN
    ALTER TABLE public.gym_pass_payments
    ADD CONSTRAINT gym_pass_payments_manual_set_null
    FOREIGN KEY (manual_client_id) REFERENCES public.gym_manual_clients(id) ON DELETE SET NULL;
  END IF;

  -- user_id: CASCADE -> SET NULL
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.gym_pass_payments'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE '%user_id%users%'
  LIMIT 1;
  IF v_con IS NOT NULL AND v_con <> 'gym_pass_payments_manual_set_null' THEN
    EXECUTE format('ALTER TABLE public.gym_pass_payments DROP CONSTRAINT %I', v_con);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gym_pass_payments_user_set_null'
  ) THEN
    ALTER TABLE public.gym_pass_payments
    ADD CONSTRAINT gym_pass_payments_user_set_null
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) CHECK: antes exigía uno de los dos FK; ahora permite ambos null
--    siempre que haya snapshot (ex-miembro / manual borrado).
DO $$
DECLARE
  v_con text;
BEGIN
  FOR v_con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.gym_pass_payments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%user_id%manual_client_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.gym_pass_payments DROP CONSTRAINT %I', v_con);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gym_pass_payments_client_check') THEN
    ALTER TABLE public.gym_pass_payments
    ADD CONSTRAINT gym_pass_payments_client_check CHECK (
      user_id IS NOT NULL OR manual_client_id IS NOT NULL OR client_name IS NOT NULL
    );
  END IF;
END $$;

-- 4) register guarda snapshot del nombre --------------------------------------
CREATE OR REPLACE FUNCTION public.register_gym_pass_payment(
  p_gym_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_manual_client_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_paid_on date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_mode text;
  v_days integer;
  v_paid date := coalesce(p_paid_on, CURRENT_DATE);
  v_start date;
  v_end date;
  v_id uuid;
  v_name text;
begin
  IF NOT public.is_gym_manager(p_gym_id) THEN
    RAISE EXCEPTION 'Solo administradores o profesores del gimnasio';
  END IF;
  IF (p_user_id IS NULL AND p_manual_client_id IS NULL)
     OR (p_user_id IS NOT NULL AND p_manual_client_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Elegí un cliente (miembro o manual)';
  END IF;
  IF p_user_id IS NOT NULL AND p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No podés registrarte un cobro a vos mismo';
  END IF;
  IF p_amount IS NOT NULL AND p_amount < 0 THEN
    RAISE EXCEPTION 'El monto no puede ser negativo';
  END IF;
  IF v_paid > CURRENT_DATE + 30 THEN
    RAISE EXCEPTION 'La fecha de pago no puede ser tan futura';
  END IF;

  SELECT g.pass_mode, g.pass_days INTO v_mode, v_days
  FROM public.gyms g WHERE g.id = p_gym_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gimnasio no encontrado'; END IF;
  v_mode := coalesce(v_mode, 'rolling');
  v_days := coalesce(v_days, 30);

  IF p_user_id IS NOT NULL THEN
    SELECT u.name INTO v_name FROM public.users u WHERE u.id = p_user_id;
    IF NOT EXISTS (SELECT 1 FROM public.gym_members gm
                   WHERE gm.gym_id = p_gym_id AND gm.user_id = p_user_id) THEN
      RAISE EXCEPTION 'Ese usuario no es miembro del gimnasio';
    END IF;
  ELSE
    SELECT mc.name INTO v_name FROM public.gym_manual_clients mc
    WHERE mc.id = p_manual_client_id AND mc.gym_id = p_gym_id;
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Cliente manual no encontrado en este gimnasio';
    END IF;
  END IF;

  IF v_mode = 'calendar' THEN
    v_start := date_trunc('month', v_paid)::date;
    v_end := (date_trunc('month', v_paid) + interval '1 month' - interval '1 day')::date;
  ELSE
    v_start := v_paid;
    v_end := v_paid + (v_days - 1);
  END IF;

  INSERT INTO public.gym_pass_payments(
    gym_id, user_id, manual_client_id, client_name, amount, paid_on,
    period_start, period_end, notes, created_by
  )
  VALUES (p_gym_id, p_user_id, p_manual_client_id, NULLIF(trim(coalesce(v_name, '')), ''),
          p_amount, v_paid, v_start, v_end, NULLIF(trim(coalesce(p_notes, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
end;
$function$;

-- 5) Config con monto (por si la base vino sin p_amount) -----------------------
CREATE OR REPLACE FUNCTION public.update_gym_pass_config(
  p_gym_id uuid, p_mode text, p_days integer, p_amount numeric DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
begin
  IF NOT public.is_gym_admin(p_gym_id) THEN
    RAISE EXCEPTION 'Solo el dueño o admins pueden cambiar la metodología del pase';
  END IF;
  IF p_mode NOT IN ('rolling', 'calendar') THEN
    RAISE EXCEPTION 'Modo inválido (rolling/calendar)';
  END IF;
  IF p_mode = 'rolling' AND (p_days IS NULL OR p_days < 1 OR p_days > 365) THEN
    RAISE EXCEPTION 'Los días deben estar entre 1 y 365';
  END IF;
  IF p_amount IS NOT NULL AND p_amount < 0 THEN
    RAISE EXCEPTION 'El monto no puede ser negativo';
  END IF;
  UPDATE public.gyms
  SET pass_mode = p_mode,
      pass_days = CASE WHEN p_mode = 'rolling' THEN p_days ELSE pass_days END,
      pass_default_amount = p_amount
  WHERE id = p_gym_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_gym_manual_client(p_client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_gym uuid;
begin
  SELECT gym_id INTO v_gym FROM public.gym_manual_clients WHERE id = p_client_id;
  IF v_gym IS NULL THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;
  IF NOT public.is_gym_manager(v_gym) THEN
    RAISE EXCEPTION 'Solo administradores o profesores del gimnasio';
  END IF;
  DELETE FROM public.gym_manual_clients WHERE id = p_client_id;
end;
$function$;

-- VERIFICACIÓN:
-- Sacar un miembro NO borra caja:
--   SELECT count(*) FROM gym_pass_payments WHERE gym_id='<gym>' AND user_id='<user>';
--   SELECT manage_gym_member('<gym>','<user>','remove');
--   SELECT count(*) FROM gym_pass_payments WHERE gym_id='<gym>' AND user_id='<user>'; -- mismo count
-- Borrar manual preserva caja con snapshot:
--   SELECT delete_gym_manual_client('<manual>');
--   SELECT id, client_name, manual_client_id FROM gym_pass_payments WHERE client_name IS NOT NULL LIMIT 5;
