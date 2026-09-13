-- MIGRACIÓN P1 (performance): índices para los hot paths + RPC optimizado.
--
-- 1) Índices compuestos para las queries que más duelen:
--    - sesión en curso: session_series por session_id/completed/serie_id
--    - progreso: sessions por (user_id, date), series por ejercicio+fecha
--    - RPC last-performed: join series↔routine_exercises por exercise_id
--    Todo idempotente (IF NOT EXISTS). Ejecutar en SQL Editor.
CREATE INDEX IF NOT EXISTS idx_session_series_session_completed
  ON public.session_series(session_id, completed);
CREATE INDEX IF NOT EXISTS idx_session_series_exercise_completed_at
  ON public.session_series(exercise_id, completed, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_series_serie_completed
  ON public.session_series(serie_id, completed);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date
  ON public.sessions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_series_routine_exercise_orden
  ON public.series(routine_exercise_id, orden);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_exercise
  ON public.routine_exercises(exercise_id);

-- 2) get_last_performed_by_exercises_by_last_planned_series reescrito:
--    - Antes: MAX(orden) correlacionado por ejercicio + UNION ALL de dos
--      candidatos + ROW_NUMBER() sobre todo → seq scans y sorts grandes.
--    - Ahora: DISTINCT ON (última serie planificada por ejercicio) + UN SOLO
--      scan de session_series con LEFT JOIN como flag is_planned +
--      DISTINCT ON final. Misma firma y mismas columnas de salida.
--    - Fix incluido: la versión anterior era SECURITY DEFINER SIN filtro de
--      usuario (devolvía la última serie de CUALQUIER usuario para esos
--      exercise_ids). Ahora se restringe a sesiones propias (mine).
--    CREATE OR REPLACE conserva los GRANTs existentes.
CREATE OR REPLACE FUNCTION public.get_last_performed_by_exercises_by_last_planned_series(p_exercise_ids uuid[])
 RETURNS TABLE(exercise_id uuid, weight_used numeric, reps_performed integer, completed_at timestamp with time zone, session_id uuid, session_series_id uuid, serie_id uuid, is_planned boolean)
 LANGUAGE sql
 SECURITY DEFINER
 STABLE
AS $function$
  WITH mine AS (
    SELECT s.id FROM public.sessions s WHERE s.user_id = auth.uid()
  ),
  -- última serie planificada (max orden) por exercise_id, en una pasada
  last_planned AS (
    SELECT DISTINCT ON (re.exercise_id) re.exercise_id, s.id AS serie_id
    FROM public.series s
    JOIN public.routine_exercises re ON re.id = s.routine_exercise_id
    WHERE re.exercise_id = ANY(p_exercise_ids)
    ORDER BY re.exercise_id, s.orden DESC
  ),
  -- un solo scan de mis series completadas, marcando si es planificada
  candidates AS (
    SELECT
      ss.exercise_id,
      ss.weight_used,
      ss.reps_performed,
      ss.completed_at,
      ss.session_id,
      ss.id AS session_series_id,
      ss.serie_id,
      (lp.serie_id IS NOT NULL) AS is_planned
    FROM public.session_series ss
    JOIN mine m ON m.id = ss.session_id
    LEFT JOIN last_planned lp
      ON lp.serie_id = ss.serie_id AND lp.exercise_id = ss.exercise_id
    WHERE ss.exercise_id = ANY(p_exercise_ids)
      AND ss.completed = true
      AND ss.completed_at IS NOT NULL
  )
  -- top-1 por ejercicio: prefiere planificada, luego la más reciente
  SELECT DISTINCT ON (exercise_id)
    exercise_id,
    weight_used,
    reps_performed,
    completed_at,
    session_id,
    session_series_id,
    serie_id,
    is_planned
  FROM candidates
  ORDER BY exercise_id, is_planned DESC, completed_at DESC;
$function$
;

-- VERIFICACIÓN:
-- EXPLAIN (COSTS OFF)
-- SELECT * FROM public.get_last_performed_by_exercises_by_last_planned_series('{<uuid>}');
-- Debe usar los índices nuevos (Index Scan / Nested Loop) en vez de Seq Scan.
