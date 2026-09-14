-- El dueño no puede salir del gimnasio: debe eliminarlo desde Editar.
-- Antes, leave_gym promovía al admin/miembro más antiguo a owner.
-- Ejecutar en SQL Editor (idempotente).

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
