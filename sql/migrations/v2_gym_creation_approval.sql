-- MIGRACIÓN v2 FASE 2: aprobación para crear gimnasio + auto-profe.
-- Todo idempotente. Ejecutar después de v2_gyms_coordinates.sql.
--
-- Modelo:
-- - users.is_app_admin: super admin de la plataforma (asignar manual vía SQL).
-- - users.can_create_gym: flag por usuario, puesto por app admin para habilitar
--   la creación del gym tras solicitud por mail.
-- - create_gym() exige uno de esos dos flags, si no levanta excepción clara.
-- - Tras crear, el dueño queda también como profesor (gym_trainers) y se
--   consume can_create_gym (vuelve a false) para no reutilizar.
-- - RPC approve_gym_creator(p_email) / revoke_gym_creator(p_email): solo app admin.
-- - Helper is_app_admin() y can_current_user_create_gym() para gating de UI.

-- 1) Flags en users ----------------------------------------------------------
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_app_admin boolean NOT NULL DEFAULT false;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS can_create_gym boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_app_admin ON public.users(is_app_admin) WHERE is_app_admin;
CREATE INDEX IF NOT EXISTS idx_users_can_create_gym ON public.users(can_create_gym) WHERE can_create_gym;

-- 2) Helper: ¿el usuario actual es app admin? -------------------------------
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.is_app_admin = true
  );
$$;

-- 3) Helper: ¿puede crear gym? (app admin o habilitado) ---------------------
CREATE OR REPLACE FUNCTION public.can_current_user_create_gym()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND (u.is_app_admin = true OR u.can_create_gym = true)
  );
$$;

-- 4) RPCs de aprobación (solo app admin) ------------------------------------
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

-- 5) Listar habilitados (solo app admin) ------------------------------------
CREATE OR REPLACE FUNCTION public.list_gym_creator_approvals()
RETURNS TABLE(user_id uuid, email text, name text, can_create_gym boolean, gym_id uuid)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT u.id, u.email, u.name, u.can_create_gym, u.gym_id
  FROM public.users u
  WHERE public.is_app_admin() = true
    AND u.can_create_gym = true
  ORDER BY u.email;
$$;

-- 6) Gating en create_gym + auto-profe -------------------------------------
-- Reemplaza el create_gym previo (incluye validaciones de nombre/dirección/coords).
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
  -- También bloquea si ya pertenece a un gym como miembro (un usuario = un gym)
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

  -- Dueño también figura como profe (solicitado)
  INSERT INTO public.gym_trainers(gym_id, user_id, specialty, schedule)
  VALUES (v_gym, v_user, NULL, '[]'::jsonb)
  ON CONFLICT (gym_id, user_id) DO NOTHING;

  UPDATE public.users SET gym_id = v_gym, can_create_gym = false WHERE id = v_user;
  RETURN v_gym;
end;
$function$;

-- VERIFICACIÓN:
-- Como usuario normal sin flag: SELECT public.create_gym('Test', p_address => 'Calle 123');
-- → 'No tenés permiso...'
-- Como app admin (tras: UPDATE users SET is_app_admin=true WHERE email='tu@mail'):
-- SELECT public.approve_gym_creator('futuro.dueno@mail');
-- Luego ese usuario ya puede crear y queda como owner+profe.
