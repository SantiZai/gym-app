-- MIGRACIÓN P1 (performance): RPC para el tipeo de peso/reps en sesión.
--
-- Por qué uno nuevo y no reusar record_or_update_series: ese RPC pisa
-- completed/completed_at (default p_completed=true). Para el guardado con
-- debounce al tipear solo queremos tocar weight/reps/updated_at y nunca el
-- estado de completado. 1 sola llamada atómica en vez de update+insert.
-- CREATE OR REPLACE conserva los GRANTs existentes. Ejecutar en SQL Editor.
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

  -- ownership (igual que record_or_update_series)
  if not exists (select 1 from public.sessions s where s.id = p_session_id and s.user_id = v_user) then
    raise exception 'Sesión no encontrada o no pertenece al usuario';
  end if;

  -- 1) update primero (caso común: la fila ya existe)
  return query
    update public.session_series ss set
      weight_used = p_weight_used,
      reps_performed = p_reps_performed,
      updated_at = now()
    where ss.session_id = p_session_id
      and ss.serie_id is not distinct from p_serie_id
    returning ss.id, ss.session_id, ss.serie_id, ss.exercise_id, ss.completed;

  if found then return; end if;

  -- 2) no existía: insertar (completed queda en su default false)
  begin
    return query
      insert into public.session_series(session_id, serie_id, exercise_id, weight_used, reps_performed)
      values (p_session_id, p_serie_id, p_exercise_id, p_weight_used, p_reps_performed)
      returning id, session_id, serie_id, exercise_id, completed;
  exception when unique_violation then
    -- 3) carrera concurrente: otro guardado insertó primero, actualizar
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

-- VERIFICACIÓN: guardar peso/reps no debe marcar la serie como completada
-- SELECT * FROM public.save_session_serie_values('<session>', '<serie>', '<ex>', 60, 10);
-- SELECT completed FROM public.session_series WHERE session_id = '<session>' AND serie_id = '<serie>';
-- → completed debe seguir igual que antes.
