-- MIGRACIÓN: al borrar una rutina, conservar las sesiones para estadísticas.
-- Antes: sessions.routine_id tenía ON DELETE CASCADE (borrar rutina borraba
-- su historial). Ahora: la columna pasa a nullable y la FK a SET NULL.
-- Las sesiones huérfanas siguen contando en progreso, racha y calendario
-- (la app muestra "Sesión" cuando falta el nombre de la rutina).
-- Todo idempotente. Ejecutar en SQL Editor.

-- 1) Permitir routine_id NULL
ALTER TABLE public.sessions ALTER COLUMN routine_id DROP NOT NULL;

-- 2) Reemplazar la FK (nombre descubierto dinámicamente por si difiere)
DO $$
DECLARE v_conname text;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  WHERE c.conrelid = 'public.sessions'::regclass
    AND c.contype = 'f'
    AND c.confrelid = 'public.routines'::regclass
    AND a.attname = 'routine_id';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sessions DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_routine_id_fkey
  FOREIGN KEY (routine_id) REFERENCES public.routines(id) ON DELETE SET NULL;

-- VERIFICACIÓN: debe mostrar ON DELETE SET NULL
-- SELECT c.conname, pg_get_constraintdef(c.oid)
-- FROM pg_constraint c
-- WHERE c.conrelid = 'public.sessions'::regclass AND c.contype = 'f';
