-- MIGRACIÓN: Comunidad — leer rutinas públicas ajenas y copiarlas.
-- Permite: ver routine_exercises/series de rutinas con public=true,
-- y expone nombre/avatar de autores sin filtrar emails (vista mínima).
-- Todo idempotente. Ejecutar en SQL Editor o vía API.

-- 1) Leer ejercicios de rutinas públicas (propias ya cubiertas por RLS owner)
DROP POLICY IF EXISTS "rutina_ejercicios_public_select" ON public.routine_exercises;
CREATE POLICY "rutina_ejercicios_public_select"
ON public.routine_exercises
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.routines r
    WHERE r.id = routine_exercises.routine_id
      AND r.public = true
  )
);

-- 2) Leer series de rutinas públicas
DROP POLICY IF EXISTS "series_public_select" ON public.series;
CREATE POLICY "series_public_select"
ON public.series
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.routine_exercises re
    JOIN public.routines r ON r.id = re.routine_id
    WHERE re.id = series.routine_exercise_id
      AND r.public = true
  )
);

-- 3) Vista mínima de autores (sin email): solo lo necesario para atribuir rutinas
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT id, name, avatar_url
FROM public.users;

GRANT SELECT ON public.public_profiles TO authenticated;

-- VERIFICACIÓN:
-- SELECT * FROM public.public_profiles LIMIT 1;
-- (como anon debe fallar; logueado debe devolver id/name/avatar_url)
