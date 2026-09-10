-- MIGRACIÓN: Consolidar drift entre base.sql y el schema real / código.
-- El código (types/db.ts, sessionUtils, userUtils) ya usa estas columnas,
-- pero base.sql nunca las declaró. Todo idempotente (IF NOT EXISTS).
-- Ejecutar en Supabase después de base.sql y las migraciones previas.

-- SESSIONS: ciclo de vida usado por finishSession() y useSessionTimer --
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS ended_at timestamptz,
ADD COLUMN IF NOT EXISTS duration text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'in_progress';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_status_check'
  ) THEN
    ALTER TABLE public.sessions
    ADD CONSTRAINT sessions_status_check CHECK (status IN ('in_progress', 'finished'));
  END IF;
END $$;

-- SESSION_SERIES: columnas usadas por updateOrCreateSessionSerie/start/complete --
ALTER TABLE public.session_series
ADD COLUMN IF NOT EXISTS exercise_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS started_at timestamptz,
ADD COLUMN IF NOT EXISTS completed_at timestamptz,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- USERS: columnas usadas por upsertUser y /perfil (goal vive en add_user_goal.sql) --
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_login timestamptz,
ADD COLUMN IF NOT EXISTS height numeric,
ADD COLUMN IF NOT EXISTS weight numeric;

-- Índices para las queries de progreso (series completadas por sesión/ejercicio) --
CREATE INDEX IF NOT EXISTS idx_session_series_exercise_id ON public.session_series(exercise_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.sessions(date);
