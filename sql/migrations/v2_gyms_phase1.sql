-- MIGRACIÓN v2 FASE 1: personalización + gestión por profes + rutinas del gym.
-- Todo idempotente. Ejecutar en SQL Editor después de v2_gyms_core/trainers/routines/storage
-- y de fix_create_gym_missing_created_by.sql.
--
-- Incluye:
-- 1) gyms.primary_color (un solo color de marca, hex #RRGGBB, null = default app)
-- 2) is_gym_manager(): owner/admin de gym_members O profe en gym_trainers.
--    Los profes pueden gestionar (agregar clientes, crear/publicar/asignar rutinas)
--    aunque su role en gym_members sea 'member'. Gestionar profes sigue siendo
--    solo owner/admin (manage_gym_trainer no cambia).
-- 3) add_gym_member_by_email(): el admin/profe asocia manualmente al cliente
--    que ya creó su cuenta (login Google/mail). Busca por email en public.users
--    del lado servidor (SECURITY DEFINER) sin exponer emails por RLS.
-- 4) manage_gym_member(): se relaja 'remove' para que el manager (incluye profe)
--    pueda expulsar; 'make_admin'/'remove_admin' siguen siendo solo owner/admin
--    (remove_admin solo owner).
-- 5) create_gym_routine(): crear rutina directamente en la biblioteca del gym.
-- 6) publish_routine_to_gym(): copiar una rutina propia (o pública) a la
--    biblioteca del gym como plantilla.
-- 7) delete_gym_routine(): borrar rutina de la biblioteca (las copias de los
--    miembros sobreviven: son filas distintas con gym_id NULL).
-- 8) assign_gym_routine(): ahora también la puede usar el profe (manager).
-- 9) RLS para que cualquier manager pueda INSERT/UPDATE/DELETE rutinas del gym
--    y sus ejercicios/series (si no, solo el creador podría editarlas).

-- 1) Color de marca ---------------------------------------------------------
ALTER TABLE public.gyms
ADD COLUMN IF NOT EXISTS primary_color text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gyms_primary_color_check') THEN
    ALTER TABLE public.gyms
    ADD CONSTRAINT gyms_primary_color_check
    CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;

-- 2) Manager = admin u profe -------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_gym_manager(p_gym_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.is_gym_admin(p_gym_id)
      OR EXISTS (
        SELECT 1 FROM public.gym_trainers gt
        WHERE gt.gym_id = p_gym_id AND gt.user_id = auth.uid()
      );
$$;

-- 3) Alta manual por email ---------------------------------------------------
-- El cliente primero crea su cuenta (Google/mail); después el manager lo asocia.
CREATE OR REPLACE FUNCTION public.add_gym_member_by_email(p_gym_id uuid, p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_target uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  IF NOT public.is_gym_manager(p_gym_id) THEN
    RAISE EXCEPTION 'Solo administradores o profesores del gimnasio';
  END IF;
  IF v_email = '' OR v_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;

  SELECT u.id INTO v_target FROM public.users u WHERE lower(u.email) = v_email;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Ningún usuario registrado con ese email (debe crear su cuenta primero)';
  END IF;

  IF EXISTS (SELECT 1 FROM public.gym_members gm
             WHERE gm.user_id = v_target AND gm.gym_id <> p_gym_id) THEN
    RAISE EXCEPTION 'Ese usuario ya pertenece a otro gimnasio';
  END IF;

  INSERT INTO public.gym_members(gym_id, user_id, role)
  VALUES (p_gym_id, v_target, 'member')
  ON CONFLICT DO NOTHING;

  UPDATE public.users SET gym_id = p_gym_id WHERE id = v_target;
  RETURN v_target;
end;
$function$;

-- 4) Expulsar también lo puede hacer el profe --------------------------------
CREATE OR REPLACE FUNCTION public.manage_gym_member(
  p_gym_id uuid, p_user_id uuid, p_action text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_caller uuid := auth.uid()::uuid;
  v_caller_role text;
  v_target_role text;
  v_caller_is_trainer boolean;
begin
  SELECT gm.role INTO v_caller_role FROM public.gym_members gm
  WHERE gm.gym_id = p_gym_id AND gm.user_id = v_caller;
  SELECT EXISTS (
    SELECT 1 FROM public.gym_trainers gt
    WHERE gt.gym_id = p_gym_id AND gt.user_id = v_caller
  ) INTO v_caller_is_trainer;

  SELECT gm.role INTO v_target_role FROM public.gym_members gm
  WHERE gm.gym_id = p_gym_id AND gm.user_id = p_user_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'Ese usuario no es miembro'; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'No se puede modificar al dueño'; END IF;

  IF p_action = 'remove' THEN
    -- Expulsar: owner/admin o profe del gym.
    IF NOT (
      v_caller_role IN ('owner', 'admin') OR v_caller_is_trainer
    ) THEN
      RAISE EXCEPTION 'Solo administradores o profesores del gimnasio';
    END IF;
    -- Un profe no puede expulsar a un admin (solo owner/admin gestionan admins).
    IF v_target_role = 'admin' AND v_caller_role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Solo administradores pueden expulsar a otro admin';
    END IF;
    DELETE FROM public.gym_members WHERE gym_id = p_gym_id AND user_id = p_user_id;
    DELETE FROM public.gym_trainers WHERE gym_id = p_gym_id AND user_id = p_user_id;
    UPDATE public.users SET gym_id = NULL WHERE id = p_user_id AND gym_id = p_gym_id;
  ELSIF p_action = 'make_admin' THEN
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Solo administradores del gimnasio';
    END IF;
    UPDATE public.gym_members SET role = 'admin'
    WHERE gym_id = p_gym_id AND user_id = p_user_id;
  ELSIF p_action = 'remove_admin' THEN
    IF v_caller_role <> 'owner' THEN RAISE EXCEPTION 'Solo el dueño puede degradar admins'; END IF;
    UPDATE public.gym_members SET role = 'member'
    WHERE gym_id = p_gym_id AND user_id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Acción inválida: %', p_action;
  END IF;
end;
$function$;

-- 5) Crear rutina directamente en el gym --------------------------------------
CREATE OR REPLACE FUNCTION public.create_gym_routine(
  p_gym_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_user uuid := auth.uid()::uuid;
  v_new uuid;
begin
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT public.is_gym_manager(p_gym_id) THEN
    RAISE EXCEPTION 'Solo administradores o profesores del gimnasio';
  END IF;
  IF coalesce(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'El nombre es requerido';
  END IF;

  INSERT INTO public.routines(user_id, name, description, public, category, gym_id)
  VALUES (v_user, trim(p_name), NULLIF(trim(coalesce(p_description, '')), ''), false,
          NULLIF(trim(coalesce(p_category, '')), ''), p_gym_id)
  RETURNING id INTO v_new;
  RETURN v_new;
end;
$function$;

-- 6) Publicar rutina propia/pública como plantilla del gym --------------------
CREATE OR REPLACE FUNCTION public.publish_routine_to_gym(p_routine_id uuid, p_gym_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_user uuid := auth.uid()::uuid;
  v_src public.routines%ROWTYPE;
  v_new uuid;
  v_re record;
  v_new_re uuid;
  v_s record;
begin
  IF NOT public.is_gym_manager(p_gym_id) THEN
    RAISE EXCEPTION 'Solo administradores o profesores del gimnasio';
  END IF;

  SELECT * INTO v_src FROM public.routines WHERE id = p_routine_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rutina no encontrada'; END IF;
  IF v_src.gym_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esa rutina ya es del gimnasio';
  END IF;
  -- Solo propia o pública (no copiar rutinas privadas ajenas).
  IF v_src.user_id <> v_user AND NOT coalesce(v_src.public, false) THEN
    RAISE EXCEPTION 'Solo podés publicar tus propias rutinas o rutinas públicas';
  END IF;

  INSERT INTO public.routines(user_id, name, description, public, category, gym_id)
  VALUES (v_user, v_src.name, v_src.description, false, v_src.category, p_gym_id)
  RETURNING id INTO v_new;

  FOR v_re IN SELECT * FROM public.routine_exercises
              WHERE routine_id = p_routine_id ORDER BY orden LOOP
    INSERT INTO public.routine_exercises(routine_id, exercise_id, orden, notes)
    VALUES (v_new, v_re.exercise_id, v_re.orden, v_re.notes)
    RETURNING id INTO v_new_re;

    FOR v_s IN SELECT * FROM public.series
               WHERE routine_exercise_id = v_re.id ORDER BY orden LOOP
      INSERT INTO public.series(routine_exercise_id, type, reps, weight, orden, notes)
      VALUES (v_new_re, v_s.type, v_s.reps, v_s.weight, v_s.orden, v_s.notes);
    END LOOP;
  END LOOP;

  RETURN v_new;
end;
$function$;

-- 7) Borrar rutina de la biblioteca (las copias privadas sobreviven) -----------
CREATE OR REPLACE FUNCTION public.delete_gym_routine(p_routine_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_gym uuid;
begin
  SELECT r.gym_id INTO v_gym FROM public.routines r WHERE r.id = p_routine_id;
  IF v_gym IS NULL THEN RAISE EXCEPTION 'No es una rutina de gimnasio'; END IF;
  IF NOT public.is_gym_manager(v_gym) THEN
    RAISE EXCEPTION 'Solo administradores o profesores del gimnasio';
  END IF;
  DELETE FROM public.routines WHERE id = p_routine_id;
end;
$function$;

-- 8) Asignar ahora también lo puede hacer el profe ------------------------------
CREATE OR REPLACE FUNCTION public.assign_gym_routine(p_routine_id uuid, p_member_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_gym uuid;
begin
  SELECT r.gym_id INTO v_gym FROM public.routines r WHERE r.id = p_routine_id;
  IF v_gym IS NULL THEN RAISE EXCEPTION 'No es una rutina de gimnasio'; END IF;
  IF NOT public.is_gym_manager(v_gym) THEN
    RAISE EXCEPTION 'Solo administradores o profesores del gimnasio';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gym_members gm
    WHERE gm.gym_id = v_gym AND gm.user_id = p_member_id
  ) THEN
    RAISE EXCEPTION 'El destino no es miembro del gimnasio';
  END IF;
  RETURN public.__copy_routine_to_user(p_routine_id, p_member_id);
end;
$function$;

-- 9) RLS: cualquier manager edita la biblioteca ---------------------------------
DROP POLICY IF EXISTS "rutinas_gym_manager_insert" ON public.routines;
CREATE POLICY "rutinas_gym_manager_insert" ON public.routines FOR INSERT
WITH CHECK (gym_id IS NOT NULL AND public.is_gym_manager(gym_id));

DROP POLICY IF EXISTS "rutinas_gym_manager_update" ON public.routines;
CREATE POLICY "rutinas_gym_manager_update" ON public.routines FOR UPDATE
USING (gym_id IS NOT NULL AND public.is_gym_manager(gym_id))
WITH CHECK (gym_id IS NOT NULL AND public.is_gym_manager(gym_id));

DROP POLICY IF EXISTS "rutinas_gym_manager_delete" ON public.routines;
CREATE POLICY "rutinas_gym_manager_delete" ON public.routines FOR DELETE
USING (gym_id IS NOT NULL AND public.is_gym_manager(gym_id));

DROP POLICY IF EXISTS "rutina_ejercicios_gym_manager_write" ON public.routine_exercises;
CREATE POLICY "rutina_ejercicios_gym_manager_write" ON public.routine_exercises FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.routines r
  WHERE r.id = routine_exercises.routine_id
    AND r.gym_id IS NOT NULL AND public.is_gym_manager(r.gym_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.routines r
  WHERE r.id = routine_exercises.routine_id
    AND r.gym_id IS NOT NULL AND public.is_gym_manager(r.gym_id)
));

DROP POLICY IF EXISTS "series_gym_manager_write" ON public.series;
CREATE POLICY "series_gym_manager_write" ON public.series FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.routine_exercises re
  JOIN public.routines r ON r.id = re.routine_id
  WHERE re.id = series.routine_exercise_id
    AND r.gym_id IS NOT NULL AND public.is_gym_manager(r.gym_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.routine_exercises re
  JOIN public.routines r ON r.id = re.routine_id
  WHERE re.id = series.routine_exercise_id
    AND r.gym_id IS NOT NULL AND public.is_gym_manager(r.gym_id)
));

-- VERIFICACIÓN:
-- SELECT public.is_gym_manager('<gym>');  -- true para owner/admin/profe
-- SELECT * FROM public.add_gym_member_by_email('<gym>', 'cliente@mail.com');
-- SELECT * FROM public.create_gym_routine('<gym>', 'Fuerza inicial', NULL, 'Fuerza');
-- Las copias por fork (gym->usuario) siguen siendo privadas con gym_id NULL:
-- al borrar la original del gym, las copias y el historial quedan intactos.
