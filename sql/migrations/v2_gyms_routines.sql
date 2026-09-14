-- MIGRACIÓN v2 FASE 0 (3/4): rutinas del gimnasio.
-- Depende de: v2_gyms_core.sql. Independiente de trainers/storage.
-- Todo idempotente. Ejecutar en SQL Editor.
--
-- Modelo: la biblioteca del gym son routines con gym_id (creadas por un admin,
-- user_id = ese admin). Los miembros las VEN (políticas SELECT) y las COPIAN
-- a su cuenta; nunca entrenan sobre el original. Asignar = copiar en nombre
-- del miembro vía RPC (RLS impide inserts cruzados por cliente).
-- Al borrar el gym, su biblioteca se borra (CASCADE); las copias de los
-- miembros y su historial quedan intactos (sessions.routine_id SET NULL ya existe).

ALTER TABLE public.routines
ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_routines_gym_id ON public.routines(gym_id);

-- Lectura para miembros del gym (OR con las policies existentes: public + owner).
-- Sin esto, fork/detalle fallarían por RLS en routine_exercises/series.
DROP POLICY IF EXISTS "rutinas_gym_member_select" ON public.routines;
CREATE POLICY "rutinas_gym_member_select" ON public.routines FOR SELECT
USING (gym_id IS NOT NULL AND public.is_gym_member(gym_id));

DROP POLICY IF EXISTS "rutina_ejercicios_gym_select" ON public.routine_exercises;
CREATE POLICY "rutina_ejercicios_gym_select" ON public.routine_exercises FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.routines r
  WHERE r.id = routine_exercises.routine_id
    AND r.gym_id IS NOT NULL AND public.is_gym_member(r.gym_id)
));

DROP POLICY IF EXISTS "series_gym_select" ON public.series;
CREATE POLICY "series_gym_select" ON public.series FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.routine_exercises re
  JOIN public.routines r ON r.id = re.routine_id
  WHERE re.id = series.routine_exercise_id
    AND r.gym_id IS NOT NULL AND public.is_gym_member(r.gym_id)
));

-- Copia profunda rutina → cuenta del usuario (privada, gym_id NULL).
-- Función interna SIN checks: la validación vive en los wrappers públicos.
CREATE OR REPLACE FUNCTION public.__copy_routine_to_user(
  p_routine_id uuid, p_target_user uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_src public.routines%ROWTYPE;
  v_new_routine uuid;
  v_re record;
  v_new_re uuid;
  v_s record;
begin
  SELECT * INTO v_src FROM public.routines WHERE id = p_routine_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rutina no encontrada'; END IF;

  INSERT INTO public.routines(user_id, name, description, public, category)
  VALUES (p_target_user, v_src.name, v_src.description, false, v_src.category)
  RETURNING id INTO v_new_routine;

  FOR v_re IN SELECT * FROM public.routine_exercises
              WHERE routine_id = p_routine_id ORDER BY orden LOOP
    INSERT INTO public.routine_exercises(routine_id, exercise_id, orden, notes)
    VALUES (v_new_routine, v_re.exercise_id, v_re.orden, v_re.notes)
    RETURNING id INTO v_new_re;

    FOR v_s IN SELECT * FROM public.series
               WHERE routine_exercise_id = v_re.id ORDER BY orden LOOP
      INSERT INTO public.series(routine_exercise_id, type, reps, weight, orden, notes)
      VALUES (v_new_re, v_s.type, v_s.reps, v_s.weight, v_s.orden, v_s.notes);
    END LOOP;
  END LOOP;

  RETURN v_new_routine;
end;
$function$;

-- Miembro copia una rutina de SU gym a su cuenta. Devuelve la nueva rutina.
CREATE OR REPLACE FUNCTION public.fork_gym_routine(p_routine_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_user uuid := auth.uid()::uuid;
  v_gym uuid;
begin
  SELECT r.gym_id INTO v_gym FROM public.routines r WHERE r.id = p_routine_id;
  IF v_gym IS NULL THEN RAISE EXCEPTION 'No es una rutina de gimnasio'; END IF;
  IF NOT public.is_gym_member(v_gym) THEN
    RAISE EXCEPTION 'Solo miembros del gimnasio';
  END IF;
  RETURN public.__copy_routine_to_user(p_routine_id, v_user);
end;
$function$;

-- Admin asigna una rutina del gym a un miembro (copia a SU cuenta).
-- Devuelve la rutina creada en la cuenta del miembro.
CREATE OR REPLACE FUNCTION public.assign_gym_routine(p_routine_id uuid, p_member_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_gym uuid;
begin
  SELECT r.gym_id INTO v_gym FROM public.routines r WHERE r.id = p_routine_id;
  IF v_gym IS NULL THEN RAISE EXCEPTION 'No es una rutina de gimnasio'; END IF;
  IF NOT public.is_gym_admin(v_gym) THEN
    RAISE EXCEPTION 'Solo administradores del gimnasio';
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

-- VERIFICACIÓN:
-- Como miembro: SELECT * FROM public.fork_gym_routine('<rutina-del-gym>');
-- Como admin:  SELECT * FROM public.assign_gym_routine('<rutina>', '<miembro>');
-- La copia debe ser privada (public=false, gym_id NULL) del usuario destino.
