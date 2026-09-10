-- USERS --
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  name text,
  avatar_url text,
  unit text check (unit in ('kg','lbs')) default 'kg',
  created_at timestamptz default now()
);

-- Primero, añadimos una restricción CHECK para limitar los valores posibles
ALTER TABLE public.users
ADD CONSTRAINT unit_check CHECK (unit IN ('imperial', 'metric'));

-- Luego, establecemos el valor por defecto para la columna
ALTER TABLE public.users
ALTER COLUMN unit SET DEFAULT 'metric';

-- Elimina la restricción que limitaba los valores a 'imperial' y 'metric'
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS unit_check;

-- TRIGGER: cuando se crea un usuario en auth.users se creá uno referenciado en public.users --
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, avatar_url)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'avatar_url', ''))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Habilitar RLS y políticas base para la tabla users --
alter table public.users enable row level security;

create policy "users_select_own"
on public.users
for select
using (auth.uid() = id);

create policy "users_update_own"
on public.users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "users_insert_auth"
on public.users
for insert
with check (auth.uid() = id);

-- EXERCISES (catálogo público) --
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle text,
  type text,
  equipment text,
  instructions text,
  origin text, -- api, manual, etc
  created_at timestamptz default now()
);

-- ROUTINES --
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  public boolean default false,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Habilitar RLS y políticas base para la tabla routines --
alter table public.routines enable row level security;

create policy "rutinas_owner_full"
on public.routines
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "rutinas_public_select"
on public.routines
for select
using (public = true);

-- ROUTINE_EXERCISES --
create table if not exists public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  orden int not null,
  notes text
);

-- Habilitar RLS y políticas base para la tabla routine_exercises --
alter table public.routine_exercises enable row level security;

create policy "rutina_ejercicios_owner_full"
on public.routine_exercises
for all
using (
  exists (
    select 1 from public.routines r
    where r.id = routine_exercises.routine_id
      and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.routines r
    where r.id = routine_exercises.routine_id
      and r.user_id = auth.uid()
  )
);

-- SERIES --
create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  routine_exercise_id uuid not null references public.routine_exercises(id) on delete cascade,
  type text not null check (type in ('warm-up','normal','dropset','otro')) default 'normal',
  reps int not null default 0,
  weight numeric(7,2),
  orden int not null,
  notes text
);
-- Habilitar RLS y políticas base para la tabla series --
alter table public.series enable row level security;

create policy "series_owner_full"
on public.series
for all
using (
  exists (
    select 1 from public.routine_exercises re
    join public.routines r on r.id = re.routine_id
    where re.id = series.routine_exercise_id
      and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.routine_exercises re
    join public.routines r on r.id = re.routine_id
    where re.id = series.routine_exercise_id
      and r.user_id = auth.uid()
  )
);

-- SESSION (routine_id nullable + SET NULL: borrar una rutina conserva su historial)
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete set null,
  date timestamptz default now(),
  notes text
);

-- Habilitar RLS y políticas base para la tabla sessions --
alter table public.sessions enable row level security;

create policy "sesiones_owner_full"
on public.sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- SESSION_SERIES --
create table if not exists public.session_series (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  serie_id uuid references public.series(id) on delete set null,
  weight_used numeric(7,2),
  reps_performed int,
  completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Habilitar RLS y políticas base para la tabla session_series --
alter table public.session_series enable row level security;

create policy "sesion_series_owner_full"
on public.session_series
for all
using (
  exists (
    select 1 from public.sessions s
    where s.id = session_series.session_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.sessions s
    where s.id = session_series.session_id
      and s.user_id = auth.uid()
  )
);

-- ÍNDICES ÚTILES --
create index if not exists idx_routines_user_id on public.routines(user_id);
create index if not exists idx_routine_exercises_routine_id on public.routine_exercises(routine_id);
create index if not exists idx_series_routine_exercise_id on public.series(routine_exercise_id);
create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_session_series_session_id on public.session_series(session_id);