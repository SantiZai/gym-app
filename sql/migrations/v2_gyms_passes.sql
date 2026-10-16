-- MIGRACIÓN v2 Pases: gestión manual de cobros sin pasarela de pagos.
-- Todo idempotente. Ejecutar en SQL Editor después de v2_gyms_phase1.sql.
--
-- Modelo (pase único simple):
-- 1) gyms.pass_mode ('rolling' = días corridos desde el pago, 'calendar' = día 1 a fin de mes)
--    gyms.pass_days (1-365, default 30, solo aplica a rolling)
--    gyms.pass_default_amount (monto por defecto para prefill rápido, editable por cobro)
-- 2) gym_manual_clients: clientes cargados a mano por caja (sin cuenta). No ven
--    rutinas ni usan la app hasta crear cuenta y vincularse por email.
-- 3) gym_pass_payments: un cobro = una vigencia. period_start/period_end se calculan
--    en el RPC según la config vigente del gym al momento del cobro:
--    - rolling: start = paid_on, end = start + pass_days - 1 (inclusive)
--    - calendar: start = 1º del mes de paid_on, end = último día de ese mes
--
-- Estados (se calculan en frontend, no se guardan):
--   vigente (end >= hoy y a más de 7 días), por_vencer (0-7 días restantes),
--   vencido (end < hoy), sin_pase (nunca pagó).
-- Retención (frontend sobre payments): renovó si pagó de nuevo dentro de los
-- 30 días posteriores al vencimiento; churn = 1 - renovación.

-- 1) Config en gyms ----------------------------------------------------------
ALTER TABLE public.gyms
ADD COLUMN IF NOT EXISTS pass_mode text DEFAULT 'rolling';

ALTER TABLE public.gyms
ADD COLUMN IF NOT EXISTS pass_days integer DEFAULT 30;

ALTER TABLE public.gyms
ADD COLUMN IF NOT EXISTS pass_default_amount numeric DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gyms_pass_mode_check') THEN
    ALTER TABLE public.gyms
    ADD CONSTRAINT gyms_pass_mode_check CHECK (pass_mode IN ('rolling', 'calendar'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gyms_pass_days_check') THEN
    ALTER TABLE public.gyms
    ADD CONSTRAINT gyms_pass_days_check CHECK (pass_days IS NULL OR (pass_days >= 1 AND pass_days <= 365));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gyms_pass_amount_check') THEN
    ALTER TABLE public.gyms
    ADD CONSTRAINT gyms_pass_amount_check CHECK (pass_default_amount IS NULL OR pass_default_amount >= 0);
  END IF;
END $$;

-- Backfill por si había filas viejas con null
UPDATE public.gyms SET pass_mode = 'rolling' WHERE pass_mode IS NULL;
UPDATE public.gyms SET pass_days = 30 WHERE pass_days IS NULL;

-- 2) Clientes manuales -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gym_manual_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 30),
  email text CHECK (email IS NULL OR char_length(email) <= 255),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_manual_clients_gym ON public.gym_manual_clients(gym_id);
CREATE INDEX IF NOT EXISTS idx_manual_clients_gym_name ON public.gym_manual_clients(gym_id, name);

ALTER TABLE public.gym_manual_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manual_clients_select" ON public.gym_manual_clients;
CREATE POLICY "manual_clients_select" ON public.gym_manual_clients FOR SELECT
USING (public.is_gym_member(gym_id));

DROP POLICY IF EXISTS "manual_clients_manager_insert" ON public.gym_manual_clients;
CREATE POLICY "manual_clients_manager_insert" ON public.gym_manual_clients FOR INSERT
WITH CHECK (public.is_gym_manager(gym_id));

DROP POLICY IF EXISTS "manual_clients_manager_update" ON public.gym_manual_clients;
CREATE POLICY "manual_clients_manager_update" ON public.gym_manual_clients FOR UPDATE
USING (public.is_gym_manager(gym_id))
WITH CHECK (public.is_gym_manager(gym_id));

DROP POLICY IF EXISTS "manual_clients_manager_delete" ON public.gym_manual_clients;
CREATE POLICY "manual_clients_manager_delete" ON public.gym_manual_clients FOR DELETE
USING (public.is_gym_manager(gym_id));

-- 3) Cobros / vigencias ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gym_pass_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  manual_client_id uuid REFERENCES public.gym_manual_clients(id) ON DELETE CASCADE,
  amount numeric CHECK (amount IS NULL OR amount >= 0),
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end >= period_start),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 300),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CHECK (
    (user_id IS NOT NULL AND manual_client_id IS NULL)
    OR (user_id IS NULL AND manual_client_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_pass_payments_gym ON public.gym_pass_payments(gym_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_pass_payments_user ON public.gym_pass_payments(user_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_pass_payments_manual ON public.gym_pass_payments(manual_client_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_pass_payments_gym_paid ON public.gym_pass_payments(gym_id, paid_on DESC);

ALTER TABLE public.gym_pass_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pass_payments_select" ON public.gym_pass_payments;
CREATE POLICY "pass_payments_select" ON public.gym_pass_payments FOR SELECT
USING (public.is_gym_member(gym_id));

DROP POLICY IF EXISTS "pass_payments_manager_insert" ON public.gym_pass_payments;
CREATE POLICY "pass_payments_manager_insert" ON public.gym_pass_payments FOR INSERT
WITH CHECK (public.is_gym_manager(gym_id));

DROP POLICY IF EXISTS "pass_payments_manager_update" ON public.gym_pass_payments;
CREATE POLICY "pass_payments_manager_update" ON public.gym_pass_payments FOR UPDATE
USING (public.is_gym_manager(gym_id))
WITH CHECK (public.is_gym_manager(gym_id));

DROP POLICY IF EXISTS "pass_payments_manager_delete" ON public.gym_pass_payments;
CREATE POLICY "pass_payments_manager_delete" ON public.gym_pass_payments FOR DELETE
USING (public.is_gym_manager(gym_id));

-- 4) RPCs --------------------------------------------------------------------

-- Configurar metodología (solo owner/admin, no profes: define caja del negocio)
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

-- Borrar cliente manual (solo managers; sus cobros se borran en cascada)
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

-- Crear cliente manual (caja). No requiere cuenta.
CREATE OR REPLACE FUNCTION public.create_gym_manual_client(
  p_gym_id uuid, p_name text, p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL, p_notes text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_id uuid;
begin
  IF NOT public.is_gym_manager(p_gym_id) THEN
    RAISE EXCEPTION 'Solo administradores o profesores del gimnasio';
  END IF;
  IF coalesce(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'El nombre del cliente es requerido';
  END IF;
  INSERT INTO public.gym_manual_clients(gym_id, name, phone, email, notes, created_by)
  VALUES (p_gym_id, trim(p_name), NULLIF(trim(coalesce(p_phone, '')), ''),
          NULLIF(trim(coalesce(p_email, '')), ''), NULLIF(trim(coalesce(p_notes, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
end;
$function$;

-- Registrar un cobro. Calcula el período según config actual del gym.
-- Uno de p_user_id / p_manual_client_id debe venir (el otro null).
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
    IF NOT EXISTS (SELECT 1 FROM public.gym_members gm
                   WHERE gm.gym_id = p_gym_id AND gm.user_id = p_user_id) THEN
      RAISE EXCEPTION 'Ese usuario no es miembro del gimnasio';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.gym_manual_clients mc
                   WHERE mc.id = p_manual_client_id AND mc.gym_id = p_gym_id) THEN
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
    gym_id, user_id, manual_client_id, amount, paid_on,
    period_start, period_end, notes, created_by
  )
  VALUES (p_gym_id, p_user_id, p_manual_client_id, p_amount, v_paid,
          v_start, v_end, NULLIF(trim(coalesce(p_notes, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_gym_pass_payment(p_payment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_gym uuid;
begin
  SELECT gym_id INTO v_gym FROM public.gym_pass_payments WHERE id = p_payment_id;
  IF v_gym IS NULL THEN RAISE EXCEPTION 'Cobro no encontrado'; END IF;
  IF NOT public.is_gym_manager(v_gym) THEN
    RAISE EXCEPTION 'Solo administradores o profesores del gimnasio';
  END IF;
  DELETE FROM public.gym_pass_payments WHERE id = p_payment_id;
end;
$function$;

-- VERIFICACIÓN:
-- SELECT pass_mode, pass_days, pass_default_amount FROM public.gyms WHERE id = '<gym>';
-- SELECT public.update_gym_pass_config('<gym>', 'rolling', 30, 15000);
-- SELECT public.create_gym_manual_client('<gym>', 'Juan Pérez', '1122334455', NULL, NULL);
-- SELECT public.register_gym_pass_payment('<gym>', '<user_id>', NULL, 15000, CURRENT_DATE, 'Efectivo');
