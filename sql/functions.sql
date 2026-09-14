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
-- - v2 gyms (FASE 0): is_gym_member, is_gym_admin, create_gym, join_gym,
--   leave_gym, manage_gym_member, manage_gym_trainer, __copy_routine_to_user,
--   fork_gym_routine, assign_gym_routine. Espejos de
--   sql/migrations/v2_gyms_{core,trainers,routines}.sql (la app los usa
--   desde Fase 1; el storage vive en v2_gyms_storage.sql).
--   Incluye fix create_gym (fix_create_gym_missing_created_by.sql).
--   Ubicación obligatoria: ver sql/migrations/v2_gyms_location.sql
--   (trigger trg_gyms_require_location + create_gym exige p_address).
--   Coordenadas: ver sql/migrations/v2_gyms_coordinates.sql
--   (gyms.latitude/longitude + create_gym acepta p_latitude/p_longitude).
-- - v2 gyms FASE 1 (sql/migrations/v2_gyms_phase1.sql): gyms.primary_color,
--   is_gym_manager (owner/admin o profe), add_gym_member_by_email,
--   create_gym_routine, publish_routine_to_gym, delete_gym_routine,
--   assign_gym_routine ahora permite profe, manage_gym_member permite
--   expulsar al profe. RLS manager para biblioteca del gym.
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

-- ==================== v2 GYMS · FASE 0 ====================
-- Espejo de sql/migrations/v2_gyms_core.sql
CREATE OR REPLACE FUNCTION public.is_gym_member(p_gym_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gym_members gm
    WHERE gm.gym_id = p_gym_id AND gm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_gym_admin(p_gym_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gym_members gm
    WHERE gm.gym_id = p_gym_id AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
  );
$$;

-- v2 FASE 2: gating + auto-profe (espejo de v2_gym_creation_approval.sql)
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.is_app_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.can_current_user_create_gym()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND (u.is_app_admin = true OR u.can_create_gym = true)
  );
$$;

CREATE OR REPLACE FUNCTION public.approve_gym_creator(p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_target uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Solo el administrador de la plataforma puede habilitar creadores';
  END IF;
  IF v_email = '' OR v_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;
  SELECT u.id INTO v_target FROM public.users u WHERE lower(u.email) = v_email;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Ningún usuario registrado con ese email (debe crear su cuenta primero)';
  END IF;
  UPDATE public.users SET can_create_gym = true WHERE id = v_target;
  RETURN v_target;
end;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_gym_creator(p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_target uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Solo el administrador de la plataforma puede revocar';
  END IF;
  SELECT u.id INTO v_target FROM public.users u WHERE lower(u.email) = v_email;
  IF v_target IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;
  UPDATE public.users SET can_create_gym = false WHERE id = v_target;
  RETURN v_target;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_gym_creator_approvals()
RETURNS TABLE(user_id uuid, email text, name text, can_create_gym boolean, gym_id uuid)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT u.id, u.email, u.name, u.can_create_gym, u.gym_id
  FROM public.users u
  WHERE public.is_app_admin() = true
    AND u.can_create_gym = true
  ORDER BY u.email;
$$;

CREATE OR REPLACE FUNCTION public.create_gym(
  p_name text,
  p_description text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_instagram text DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_maps_url text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_user uuid := auth.uid()::uuid;
  v_gym uuid;
  v_is_admin boolean;
  v_can_create boolean;
begin
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF coalesce(trim(p_name), '') = '' THEN RAISE EXCEPTION 'El nombre es requerido'; END IF;
  IF coalesce(trim(coalesce(p_address, '')), '') = '' THEN
    RAISE EXCEPTION 'La ubicación del gimnasio es obligatoria (dirección)';
  END IF;

  SELECT u.is_app_admin, u.can_create_gym INTO v_is_admin, v_can_create
  FROM public.users u WHERE u.id = v_user;

  IF NOT coalesce(v_is_admin, false) AND NOT coalesce(v_can_create, false) THEN
    RAISE EXCEPTION 'No tenés permiso para crear gimnasio. Solicitá el alta por mail y el admin te habilitará.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.gyms g WHERE g.created_by = v_user) THEN
    RAISE EXCEPTION 'Ya creaste un gimnasio (máximo 1 por usuario)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gym_members gm WHERE gm.user_id = v_user) THEN
    RAISE EXCEPTION 'Ya pertenecés a un gimnasio (no podés crear otro)';
  END IF;

  INSERT INTO public.gyms(name, description, phone, email, instagram, website, address, maps_url, created_by, latitude, longitude)
  VALUES (p_name, NULLIF(p_description, ''), NULLIF(p_phone, ''), NULLIF(p_email, ''),
          NULLIF(p_instagram, ''), NULLIF(p_website, ''), NULLIF(trim(p_address), ''), NULLIF(p_maps_url, ''), v_user,
          p_latitude, p_longitude)
  RETURNING id INTO v_gym;

  INSERT INTO public.gym_members(gym_id, user_id, role)
  VALUES (v_gym, v_user, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.gym_trainers(gym_id, user_id, specialty, schedule)
  VALUES (v_gym, v_user, NULL, '[]'::jsonb)
  ON CONFLICT (gym_id, user_id) DO NOTHING;

  UPDATE public.users SET gym_id = v_gym, can_create_gym = false WHERE id = v_user;
  RETURN v_gym;
end;
$function$;

-- Espejo de sql/migrations/v2_gyms_location.sql
CREATE OR REPLACE FUNCTION public.validate_gym_location()
RETURNS trigger LANGUAGE plpgsql AS $function$
begin
  IF coalesce(trim(NEW.address), '') = '' OR char_length(trim(NEW.address)) < 3 THEN
    RAISE EXCEPTION 'La ubicación del gimnasio es obligatoria (dirección)';
  END IF;
  RETURN NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.join_gym(p_gym_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_user uuid := auth.uid()::uuid;
begin
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gyms g WHERE g.id = p_gym_id) THEN
    RAISE EXCEPTION 'Gimnasio no encontrado';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gym_members gm
             WHERE gm.user_id = v_user AND gm.gym_id <> p_gym_id) THEN
    RAISE EXCEPTION 'Ya pertenecés a otro gimnasio (salí primero para cambiarte)';
  END IF;

  INSERT INTO public.gym_members(gym_id, user_id, role)
  VALUES (p_gym_id, v_user, 'member')
  ON CONFLICT DO NOTHING;

  UPDATE public.users SET gym_id = p_gym_id WHERE id = v_user;
end;
$function$;

CREATE OR REPLACE FUNCTION public.leave_gym()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_user uuid := auth.uid()::uuid;
  v_gym uuid;
  v_role text;
begin
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT gm.gym_id, gm.role INTO v_gym, v_role
  FROM public.gym_members gm WHERE gm.user_id = v_user LIMIT 1;
  IF v_gym IS NULL THEN RETURN; END IF;

  IF v_role = 'owner' THEN
    RAISE EXCEPTION 'El dueño no puede salir del gimnasio: eliminalo desde Editar';
  END IF;

  DELETE FROM public.gym_members WHERE gym_id = v_gym AND user_id = v_user;
  DELETE FROM public.gym_trainers WHERE gym_id = v_gym AND user_id = v_user;
  UPDATE public.users SET gym_id = NULL WHERE id = v_user AND gym_id = v_gym;
end;
$function$;

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
    IF NOT (
      v_caller_role IN ('owner', 'admin') OR v_caller_is_trainer
    ) THEN
      RAISE EXCEPTION 'Solo administradores o profesores del gimnasio';
    END IF;
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

-- Espejo de sql/migrations/v2_gyms_trainers.sql
CREATE OR REPLACE FUNCTION public.manage_gym_trainer(
  p_gym_id uuid,
  p_user_id uuid,
  p_action text,
  p_specialty text DEFAULT NULL,
  p_schedule jsonb DEFAULT '[]'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
begin
  IF NOT public.is_gym_admin(p_gym_id) THEN
    RAISE EXCEPTION 'Solo administradores del gimnasio';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_members gm
    WHERE gm.gym_id = p_gym_id AND gm.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Solo un miembro del gimnasio puede ser profesor';
  END IF;

  IF p_action = 'add' THEN
    IF p_schedule IS NULL OR jsonb_typeof(p_schedule) <> 'array' THEN
      RAISE EXCEPTION 'Horarios inválidos';
    END IF;
    INSERT INTO public.gym_trainers(gym_id, user_id, specialty, schedule)
    VALUES (p_gym_id, p_user_id, NULLIF(p_specialty, ''), p_schedule)
    ON CONFLICT (gym_id, user_id)
    DO UPDATE SET specialty = EXCLUDED.specialty, schedule = EXCLUDED.schedule;
  ELSIF p_action = 'remove' THEN
    DELETE FROM public.gym_trainers WHERE gym_id = p_gym_id AND user_id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Acción inválida: %', p_action;
  END IF;
end;
$function$;

-- Espejo de sql/migrations/v2_gyms_routines.sql
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

-- ==================== v2 GYMS · FASE 1 ====================
-- Espejo de sql/migrations/v2_gyms_phase1.sql
CREATE OR REPLACE FUNCTION public.is_gym_manager(p_gym_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.is_gym_admin(p_gym_id)
      OR EXISTS (
        SELECT 1 FROM public.gym_trainers gt
        WHERE gt.gym_id = p_gym_id AND gt.user_id = auth.uid()
      );
$$;

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
