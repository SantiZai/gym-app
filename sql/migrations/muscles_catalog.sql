-- MIGRACIÓN: taxonomía precisa por músculo (16) + FK en exercises + wipe del catálogo.
--
-- QUÉ HACE:
-- 1) Crea la tabla `muscles` (id = slug estable) y siembra los 16 músculos.
-- 2) Agrega `exercises.primary_muscle_id` (FK) + `exercises.secondary_muscle_ids` (text[]).
-- 3) Vacía planificaciones (series, routine_exercises) y el catálogo viejo.
--    ⚠️ Las rutinas QUEDAN VACÍAS (conservan nombre/descripción).
--    El historial de session_series se desvincula pero conserva pesos/reps/fechas.
-- 4) Elimina la columna libre `exercises.muscle` y exige músculo principal en altas nuevas.
--
-- DESPUÉS: cargar ejercicios con un `primary_muscle_id` válido
-- (ver sql/add_exercise_template.sql). Slugs válidos:
-- pectoral, dorsal, trapecio, deltoides-anterior, deltoides-medio,
-- deltoides-posterior, biceps, triceps, antebrazo, abdominales, oblicuos,
-- lumbares, cuadriceps, isquiotibiales, gluteos, gemelos.
--
-- PREVIAMENTE: backup (Supabase → Database → Backups) y avisar a usuarios.
-- Ejecutar en SQL Editor.

-- 1) Catálogo de músculos -------------------------------------------------
create table if not exists public.muscles (
  id text primary key,
  name text not null,
  region text not null,
  color text not null,
  sort int not null
);

insert into public.muscles (id, name, region, color, sort) values
  ('pectoral', 'Pectoral', 'Pecho', '#3b82f6', 1),
  ('dorsal', 'Dorsal ancho', 'Espalda', '#10b981', 2),
  ('trapecio', 'Trapecio', 'Espalda', '#14b8a6', 3),
  ('deltoides-anterior', 'Deltoides anterior', 'Hombros', '#8b5cf6', 4),
  ('deltoides-medio', 'Deltoides medio', 'Hombros', '#c084fc', 5),
  ('deltoides-posterior', 'Deltoides posterior', 'Hombros', '#6d28d9', 6),
  ('biceps', 'Bíceps', 'Brazos', '#ec4899', 7),
  ('triceps', 'Tríceps', 'Brazos', '#f43f5e', 8),
  ('antebrazo', 'Antebrazo', 'Brazos', '#f472b6', 9),
  ('abdominales', 'Abdominales', 'Core', '#06b6d4', 10),
  ('oblicuos', 'Oblicuos', 'Core', '#0ea5e9', 11),
  ('lumbares', 'Lumbares', 'Core', '#d946ef', 12),
  ('cuadriceps', 'Cuádriceps', 'Piernas', '#f59e0b', 13),
  ('isquiotibiales', 'Isquiotibiales', 'Piernas', '#f97316', 14),
  ('gluteos', 'Glúteos', 'Piernas', '#ef4444', 15),
  ('gemelos', 'Gemelos', 'Piernas', '#84cc16', 16)
on conflict (id) do update set
  name = excluded.name,
  region = excluded.region,
  color = excluded.color,
  sort = excluded.sort;

-- 2) Columnas nuevas en exercises ------------------------------------------
alter table public.exercises
  add column if not exists primary_muscle_id text references public.muscles(id),
  add column if not exists secondary_muscle_ids text[] not null default '{}';

create index if not exists idx_exercises_primary_muscle
  on public.exercises(primary_muscle_id);

begin;

-- 3) Vaciar planificaciones, composiciones y catálogo viejo -----------------
-- Preservar historial pase lo que pase con las FKs
update public.session_series set exercise_id = null where exercise_id is not null;
update public.session_series set serie_id = null where serie_id is not null;

delete from public.series;
delete from public.routine_exercises;
delete from public.exercises;

-- 4) Eliminar columna libre y exigir músculo principal ----------------------
alter table public.exercises drop column if exists muscle;
alter table public.exercises alter column primary_muscle_id set not null;

commit;

-- VERIFICACIÓN:
-- select count(*) from public.muscles; -- debe devolver 16
-- select count(*) from public.exercises; -- debe devolver 0
