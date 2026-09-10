-- MIGRACIÓN: fix finish_session — column reference "started_at" is ambiguous (42702).
-- Causa: los parámetros OUT (started_at, ended_at, duration...) chocan con
-- las columnas en referencias sin calificar. Se califica todo con alias.
-- Además el RETURNS TABLE iguala los tipos reales: ended_at es timestamp
-- sin zona y sum() devuelve bigint (si no, error 42804).
-- CREATE OR REPLACE conserva los GRANTs existentes. Ejecutar en SQL Editor.

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

  -- Fechas en variables (evita ambigüedad con los OUT params)
  select s.started_at, s.date into v_started, v_date
  from public.sessions s where s.id = p_session_id;

  -- Cerrar sesión
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

-- VERIFICACIÓN: finalizar una sesión desde la app debe mostrar el resumen
-- en vez de: column reference "started_at" is ambiguous (42702).
