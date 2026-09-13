-- SNAPSHOT de las funciones reales en Supabase (proyecto app-gimnasio).
-- Obtenido desde pg_get_functiondef: esto ES lo que corre en producción.
--
-- Estas funciones se crean/evolucionan desde el SQL Editor del dashboard.
-- Este archivo es solo espejo versionado: es seguro re-ejecutarlo
-- (todo es CREATE OR REPLACE) pero NO editarlo a ciegas sin aplicar
-- el cambio también en la DB.
--
-- Estado:
-- - start_session, create_routine_basic y
--   get_last_performed_by_exercises_by_last_planned_series: en uso por la app.
-- - save_session_serie_values: en uso (tipeo peso/reps, updateOrCreateSessionSerie).
--   Ver sql/migrations/perf_save_serie_values_rpc.sql.
-- - finish_session: en uso; incluye fix 42702 de
--   sql/migrations/fix_finish_session_ambiguous.sql (aplicar en DB).
-- - finish_session, record_or_update_series y get_last_performed_by_exercises:
--   existen en la DB pero la app hoy NO las usa (finish/record se hacen
--   por cliente en utils/sessionUtils.ts).

CREATE OR REPLACE FUNCTION public.create_routine_basic(p_payload jsonb)
 RETURNS TABLE(routine_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_user uuid := auth.uid()::uuid;
  v_rutina uuid;
  re_item jsonb;
  v_re_id uuid;
  v_ejercicio_exists boolean;
begin
  -- Validación mínima
  if coalesce(p_payload ->> 'nombre', '') = '' then
    raise exception 'nombre es requerido';
  end if;

  -- Insert rutina
  insert into public.routines (user_id, name, description, public)
  values (
    v_user,
    p_payload ->> 'nombre',
    nullif(p_payload ->> 'descripcion', ''),
    coalesce((p_payload ->> 'publica')::boolean, false)
  )
  returning id into v_rutina;

  -- Iterar ejercicios (solo crea rutina_ejercicios, NO crea series)
  for re_item in
    select jsonb_array_elements(coalesce(p_payload -> 'ejercicios', '[]'::jsonb))
  loop
    -- Validar ejercicio_id provisto y que exista en catálogo
    if (re_item ->> 'ejercicio_id') is null or (re_item ->> 'ejercicio_id') = '' then
      raise exception 'Cada item de ejercicios requiere ejercicio_id';
    end if;

    select exists (select 1 from public.exercises e where e.id = (re_item ->> 'ejercicio_id')::uuid)
    into v_ejercicio_exists;

    if not v_ejercicio_exists then
      raise exception 'Ejercicio % no existe en el catálogo', (re_item ->> 'ejercicio_id');
    end if;

    -- Insert rutina_ejercicios
    insert into public.routine_exercises (routine_id, exercise_id, orden, notes)
    values (
      v_rutina,
      (re_item ->> 'ejercicio_id')::uuid,
      coalesce((re_item ->> 'orden')::int, 0),
      nullif(re_item ->> 'notas', '')
    )
    returning id into v_re_id;
    -- No insertamos series aquí (se crearán luego al editar la rutina)
  end loop;

  return query select v_rutina as rutina_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.finish_session(p_session_id uuid, p_end_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(session_id uuid, user_id uuid, routine_id uuid, started_at timestamp with time zone, ended_at timestamp, duration interval, total_series_completed bigint, total_volume numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_user uuid;
  v_started timestamp with time zone;
  v_date timestamp with time zone;
begin
  v_user := auth.uid()::uuid;

  -- Check ownership
  if not exists (select 1 from public.sessions s where s.id = p_session_id and s.user_id = v_user) then
    raise exception 'Sesión no encontrada o no pertenece al usuario';
  end if;

  -- Fechas en variables (evita ambigüedad con los OUT params - fix 42702)
  select s.started_at, s.date into v_started, v_date
  from public.sessions s where s.id = p_session_id;

  -- Actualizar sesión: ended_at, duration y status
  update public.sessions set
    ended_at = p_end_at,
    duration = p_end_at - coalesce(v_started, v_date),
    status = 'finished'
  where public.sessions.id = p_session_id;

  -- Devolver resumen agregado
  return query
    select
      s.id as session_id,
      s.user_id,
      s.routine_id,
      s.started_at,
      s.ended_at,
      s.duration,
      coalesce(sum(case when ss.completed then 1 else 0 end), 0) as total_series_completed,
      coalesce(sum( (coalesce(ss.weight_used,0)::numeric) * (coalesce(ss.reps_performed,0)::numeric) ), 0) as total_volume
    from public.sessions s
    left join public.session_series ss on ss.session_id = s.id
    where s.id = p_session_id
    group by s.id, s.user_id, s.routine_id, s.started_at, s.ended_at, s.duration;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_last_performed_by_exercises(p_exercise_ids uuid[])
 RETURNS TABLE(exercise_id uuid, weight_used numeric, reps_performed integer, completed_at timestamp with time zone, session_id uuid, session_series_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  with last_per_ex as (
    select
      ss.exercise_id,
      max(ss.completed_at) as last_completed_at
    from public.session_series ss
    where ss.exercise_id = any(p_exercise_ids)
      and ss.completed = true
      and ss.completed_at is not null
    group by ss.exercise_id
  )
  select
    ss.exercise_id,
    ss.weight_used,
    ss.reps_performed,
    ss.completed_at,
    ss.session_id,
    ss.id as session_series_id
  from public.session_series ss
  join last_per_ex l on ss.exercise_id = l.exercise_id and ss.completed_at = l.last_completed_at;
$function$
;

CREATE OR REPLACE FUNCTION public.get_last_performed_by_exercises_by_last_planned_series(p_exercise_ids uuid[])
 RETURNS TABLE(exercise_id uuid, weight_used numeric, reps_performed integer, completed_at timestamp with time zone, session_id uuid, session_series_id uuid, serie_id uuid, is_planned boolean)
 LANGUAGE sql
 SECURITY DEFINER
 STABLE
AS $function$
-- Reescrita en sql/migrations/perf_session_series_indexes.sql: DISTINCT ON
-- (sin MAX correlacionado ni window) + filtrada al usuario actual.
with
-- sesiones propias (la versión anterior no filtraba por usuario)
mine as (
  select s.id from public.sessions s where s.user_id = auth.uid()
),
-- 1) "última serie planificada" (max orden) por exercise_id, en una pasada
last_planned_series as (
  select distinct on (re.exercise_id) re.exercise_id, s.id as serie_id
  from public.series s
  join public.routine_exercises re on re.id = s.routine_exercise_id
  where re.exercise_id = any(p_exercise_ids)
  order by re.exercise_id, s.orden desc
),
-- 2) un solo scan de mis series completadas, marcando si es planificada
candidates as (
  select
    ss.exercise_id,
    ss.weight_used,
    ss.reps_performed,
    ss.completed_at,
    ss.session_id,
    ss.id as session_series_id,
    ss.serie_id,
    (lp.serie_id is not null) as is_planned
  from public.session_series ss
  join mine m on m.id = ss.session_id
  left join last_planned_series lp
    on lp.serie_id = ss.serie_id and lp.exercise_id = ss.exercise_id
  where ss.exercise_id = any(p_exercise_ids)
    and ss.completed = true
    and ss.completed_at is not null
)
-- 3) top-1 por ejercicio: prefiere planificada, luego la más reciente
select distinct on (exercise_id)
  exercise_id,
  weight_used,
  reps_performed,
  completed_at,
  session_id,
  session_series_id,
  serie_id,
  is_planned
from candidates
order by exercise_id, is_planned desc, completed_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.record_or_update_series(p_session_id uuid, p_serie_id uuid DEFAULT NULL::uuid, p_exercise_id uuid DEFAULT NULL::uuid, p_weight_used numeric DEFAULT NULL::numeric, p_reps_performed integer DEFAULT NULL::integer, p_started_at timestamp with time zone DEFAULT now(), p_completed_at timestamp with time zone DEFAULT now(), p_completed boolean DEFAULT true, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(id uuid, session_id uuid, serie_id uuid, exercise_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_user uuid;
  v_owner_check boolean;
  v_existing_id uuid;
begin
  v_user := auth.uid()::uuid;

  -- Verificar que la sesión exista y pertenezca al usuario
  select (s.user_id = v_user) into v_owner_check
  from public.sessions s
  where s.id = p_session_id;

  if not v_owner_check then
    raise exception 'Sesión no encontrada o no pertenece al usuario';
  end if;

  -- Si p_serie_id es provisto, intentar upsert basado en (session_id, serie_id)
  if p_serie_id is not null then
    select id into v_existing_id from public.session_series
    where session_id = p_session_id and serie_id = p_serie_id
    limit 1;

    if v_existing_id is not null then
      update public.session_series set
        exercise_id = coalesce(p_exercise_id, exercise_id),
        weight_used = p_weight_used,
        reps_performed = p_reps_performed,
        started_at = coalesce(p_started_at, started_at),
        completed_at = p_completed_at,
        completed = p_completed,
        metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
        updated_at = now()
      where id = v_existing_id
      returning id, session_id, serie_id, exercise_id into id, session_id, serie_id, exercise_id;
      return;
    else
      -- Insertar nueva fila (serie planificada completada por primera vez)
      insert into public.session_series(
        session_id, serie_id, exercise_id, weight_used, reps_performed, started_at, completed_at, completed, metadata, created_at, updated_at
      ) values (
        p_session_id, p_serie_id, p_exercise_id, p_weight_used, p_reps_performed, p_started_at, p_completed_at, p_completed, p_metadata, now(), now()
      )
      returning id, session_id, serie_id, exercise_id into id, session_id, serie_id, exercise_id;
      return;
    end if;

  else
    -- Caso ad-hoc: insertar sin serie_id
    insert into public.session_series(
      session_id, serie_id, exercise_id, weight_used, reps_performed, started_at, completed_at, completed, metadata, created_at, updated_at
    ) values (
      p_session_id, null, p_exercise_id, p_weight_used, p_reps_performed, p_started_at, p_completed_at, p_completed, p_metadata, now(), now()
    )
    returning id, session_id, serie_id, exercise_id into id, session_id, serie_id, exercise_id;
    return;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.start_session(p_routine_id uuid, p_start_at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_user uuid;
  v_session uuid;
  v_exists boolean;
begin
  -- uid del request
  v_user := auth.uid()::uuid;

  -- Validar que la rutina exista y pertenezca al usuario
  select exists (
    select 1 from public.routines r
    where r.id = p_routine_id and r.user_id = v_user
  ) into v_exists;

  if not v_exists then
    raise exception 'Rutina no encontrada o no pertenece al usuario' using hint='Comprueba p_routine_id y owner';
  end if;

  insert into public.sessions (user_id, routine_id, date, started_at, status)
  values (v_user, p_routine_id, p_start_at, p_start_at, 'in_progress')
  returning id into v_session;

  return v_session;
end;
$function$
;

-- Espejo de sql/migrations/perf_save_serie_values_rpc.sql: upsert SOLO de
-- peso/reps (no toca completed). Lo usa updateOrCreateSessionSerie.
CREATE OR REPLACE FUNCTION public.save_session_serie_values(
  p_session_id uuid,
  p_serie_id uuid,
  p_exercise_id uuid DEFAULT NULL,
  p_weight_used numeric DEFAULT NULL,
  p_reps_performed integer DEFAULT NULL
)
 RETURNS TABLE(id uuid, session_id uuid, serie_id uuid, exercise_id uuid, completed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_user uuid;
begin
  v_user := auth.uid()::uuid;

  if not exists (select 1 from public.sessions s where s.id = p_session_id and s.user_id = v_user) then
    raise exception 'Sesión no encontrada o no pertenece al usuario';
  end if;

  return query
    update public.session_series ss set
      weight_used = p_weight_used,
      reps_performed = p_reps_performed,
      updated_at = now()
    where ss.session_id = p_session_id
      and ss.serie_id is not distinct from p_serie_id
    returning ss.id, ss.session_id, ss.serie_id, ss.exercise_id, ss.completed;

  if found then return; end if;

  begin
    return query
      insert into public.session_series(session_id, serie_id, exercise_id, weight_used, reps_performed)
      values (p_session_id, p_serie_id, p_exercise_id, p_weight_used, p_reps_performed)
      returning id, session_id, serie_id, exercise_id, completed;
  exception when unique_violation then
    return query
      update public.session_series ss set
        weight_used = p_weight_used,
        reps_performed = p_reps_performed,
        updated_at = now()
      where ss.session_id = p_session_id
        and ss.serie_id is not distinct from p_serie_id
      returning ss.id, ss.session_id, ss.serie_id, ss.exercise_id, ss.completed;
  end;
end;
$function$
;
