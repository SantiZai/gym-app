CREATE OR REPLACE FUNCTION public.save_routine_full(
  p_routine_id uuid,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_user uuid := auth.uid()::uuid;
  v_routine uuid := p_routine_id;
  v_owner uuid;
  v_gym uuid;
  v_name text;
  v_item jsonb;
  v_serie jsonb;
  v_re_id uuid;
  v_serie_id uuid;
  v_keep_re uuid[] := '{}';
  v_keep_series uuid[] := '{}';
begin
  if v_user is null then
    raise exception 'No autenticado';
  end if;

  v_name := nullif(trim(coalesce(p_payload ->> 'nombre', '')), '');
  if v_name is null then
    raise exception 'El nombre de la rutina es requerido';
  end if;

  if v_routine is null then
    insert into public.routines (user_id, name, description, public, category)
    values (
      v_user,
      v_name,
      nullif(trim(coalesce(p_payload ->> 'descripcion', '')), ''),
      coalesce((p_payload ->> 'publica')::boolean, false),
      nullif(trim(coalesce(p_payload ->> 'categoria', '')), '')
    )
    returning id into v_routine;
  else
    select r.user_id, r.gym_id
    into v_owner, v_gym
    from public.routines r
    where r.id = v_routine;

    if not found then
      raise exception 'Rutina no encontrada';
    end if;

    if v_owner <> v_user and not (v_gym is not null and public.is_gym_manager(v_gym)) then
      raise exception 'No tenés permiso para editar esta rutina';
    end if;

    update public.routines
    set name = v_name,
        description = nullif(trim(coalesce(p_payload ->> 'descripcion', '')), ''),
        public = coalesce((p_payload ->> 'publica')::boolean, false),
        category = coalesce(nullif(trim(coalesce(p_payload ->> 'categoria', '')), ''), category),
        updated_at = now()
    where id = v_routine;
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_payload -> 'ejercicios', '[]'::jsonb))
  loop
    v_re_id := nullif(v_item ->> 'routine_exercise_id', '')::uuid;

    if v_re_id is not null then
      update public.routine_exercises
      set exercise_id = (v_item ->> 'ejercicio_id')::uuid,
          orden = coalesce((v_item ->> 'orden')::int, 0),
          notes = nullif(v_item ->> 'notas', '')
      where id = v_re_id
        and routine_id = v_routine;

      if not found then
        v_re_id := null;
      end if;
    end if;

    if v_re_id is null then
      insert into public.routine_exercises (routine_id, exercise_id, orden, notes)
      values (
        v_routine,
        (v_item ->> 'ejercicio_id')::uuid,
        coalesce((v_item ->> 'orden')::int, 0),
        nullif(v_item ->> 'notas', '')
      )
      returning id into v_re_id;
    end if;

    v_keep_re := array_append(v_keep_re, v_re_id);
    v_keep_series := '{}';

    for v_serie in
      select value from jsonb_array_elements(coalesce(v_item -> 'series', '[]'::jsonb))
    loop
      v_serie_id := nullif(v_serie ->> 'serie_id', '')::uuid;

      if v_serie_id is not null then
        update public.series
        set type = coalesce(nullif(v_serie ->> 'type', ''), 'normal'),
            reps = coalesce(nullif(v_serie ->> 'reps', '')::int, 0),
            weight = nullif(v_serie ->> 'weight', '')::numeric,
            orden = coalesce((v_serie ->> 'orden')::int, 0),
            notes = nullif(v_serie ->> 'notes', '')
        where id = v_serie_id
          and routine_exercise_id = v_re_id;

        if not found then
          v_serie_id := null;
        end if;
      end if;

      if v_serie_id is null then
        insert into public.series (routine_exercise_id, type, reps, weight, orden, notes)
        values (
          v_re_id,
          coalesce(nullif(v_serie ->> 'type', ''), 'normal'),
          coalesce(nullif(v_serie ->> 'reps', '')::int, 0),
          nullif(v_serie ->> 'weight', '')::numeric,
          coalesce((v_serie ->> 'orden')::int, 0),
          nullif(v_serie ->> 'notes', '')
        )
        returning id into v_serie_id;
      end if;

      v_keep_series := array_append(v_keep_series, v_serie_id);
    end loop;

    delete from public.series
    where routine_exercise_id = v_re_id
      and not (id = any(v_keep_series));
  end loop;

  delete from public.routine_exercises
  where routine_id = v_routine
    and not (id = any(v_keep_re));

  return v_routine;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.save_routine_full(uuid, jsonb) TO authenticated;
