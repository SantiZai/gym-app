-- MIGRACIÓN v2 FASE 0 (1/4): gimnasios + miembros + users.gym_id.
-- Ejecutar ESTA primero; v2_gyms_trainers / v2_gyms_routines / v2_gyms_storage
-- son independientes entre sí pero dependen de esta.
-- Todo idempotente. Ejecutar en SQL Editor.
--
-- Modelo: un usuario pertenece a lo sumo a UN gym (users.gym_id nullable).
-- Roles por gym: owner (creador, único, no degradable) > admin > member.

-- 1) Tabla gyms
CREATE TABLE IF NOT EXISTS public.gyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  logo_url text,
  phone text CHECK (phone IS NULL OR char_length(phone) <= 30),
  email text CHECK (email IS NULL OR char_length(email) <= 255),
  instagram text CHECK (instagram IS NULL OR char_length(instagram) <= 80),
  website text CHECK (website IS NULL OR char_length(website) <= 255),
  address text CHECK (address IS NULL OR char_length(address) <= 255),
  maps_url text CHECK (maps_url IS NULL OR char_length(maps_url) <= 500),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 2) Membresías + rol por gym
CREATE TABLE IF NOT EXISTS public.gym_members (
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (gym_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_gym_members_user ON public.gym_members(user_id);
CREATE INDEX IF NOT EXISTS idx_gym_members_gym_role ON public.gym_members(gym_id, role);

-- 3) Gym del usuario (null = sin gym)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_gym_id ON public.users(gym_id);

ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_members ENABLE ROW LEVEL SECURITY;

-- 4) Helpers SECURITY DEFINER (evitan recursión RLS en policies que
-- consultan gym_members, y se reusan en los RPCs)
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

-- 5) RLS gyms: lectura pública (directorio), escritura solo admins
DROP POLICY IF EXISTS "gyms_select" ON public.gyms;
CREATE POLICY "gyms_select" ON public.gyms FOR SELECT USING (true);

DROP POLICY IF EXISTS "gyms_insert" ON public.gyms;
CREATE POLICY "gyms_insert" ON public.gyms FOR INSERT
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "gyms_admin_update" ON public.gyms;
CREATE POLICY "gyms_admin_update" ON public.gyms FOR UPDATE
USING (public.is_gym_admin(id))
WITH CHECK (public.is_gym_admin(id));

DROP POLICY IF EXISTS "gyms_owner_delete" ON public.gyms;
CREATE POLICY "gyms_owner_delete" ON public.gyms FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.gym_members gm
  WHERE gm.gym_id = gyms.id AND gm.user_id = auth.uid() AND gm.role = 'owner'
));

-- 6) RLS gym_members: solo miembros del gym ven la lista; escrituras vía RPC
DROP POLICY IF EXISTS "gym_members_select" ON public.gym_members;
CREATE POLICY "gym_members_select" ON public.gym_members FOR SELECT
USING (public.is_gym_member(gym_id));

-- 7) RPCs base
-- Crear gym (el creador queda como owner + su gym_id apunta al gym)
CREATE OR REPLACE FUNCTION public.create_gym(
  p_name text,
  p_description text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_instagram text DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_maps_url text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_user uuid := auth.uid()::uuid;
  v_gym uuid;
begin
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF coalesce(trim(p_name), '') = '' THEN RAISE EXCEPTION 'El nombre es requerido'; END IF;
  IF coalesce(trim(coalesce(p_address, '')), '') = '' THEN
    RAISE EXCEPTION 'La ubicación del gimnasio es obligatoria (dirección)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gyms g WHERE g.created_by = v_user) THEN
    RAISE EXCEPTION 'Ya creaste un gimnasio (máximo 1 por usuario)';
  END IF;

  INSERT INTO public.gyms(name, description, phone, email, instagram, website, address, maps_url, created_by)
  VALUES (p_name, NULLIF(p_description, ''), NULLIF(p_phone, ''), NULLIF(p_email, ''),
          NULLIF(p_instagram, ''), NULLIF(p_website, ''), NULLIF(trim(p_address), ''), NULLIF(p_maps_url, ''), v_user)
  RETURNING id INTO v_gym;

  INSERT INTO public.gym_members(gym_id, user_id, role)
  VALUES (v_gym, v_user, 'owner')
  ON CONFLICT DO NOTHING;

  UPDATE public.users SET gym_id = v_gym WHERE id = v_user;
  RETURN v_gym;
end;
$function$;

-- Unirse (solo si no tiene OTRA membresía; hay que salir primero).
-- Se mira gym_members (fuente de verdad), no solo users.gym_id.
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

-- Salirse (el owner promueve al admin más antiguo; si no hay admins, al
-- miembro más antiguo; si queda vacío, el gym sigue existiendo)
CREATE OR REPLACE FUNCTION public.leave_gym()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_user uuid := auth.uid()::uuid;
  v_gym uuid;
  v_role text;
  v_next uuid;
begin
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT gm.gym_id, gm.role INTO v_gym, v_role
  FROM public.gym_members gm WHERE gm.user_id = v_user LIMIT 1;
  IF v_gym IS NULL THEN RETURN; END IF;

  IF v_role = 'owner' THEN
    SELECT gm.user_id INTO v_next FROM public.gym_members gm
    WHERE gm.gym_id = v_gym AND gm.user_id <> v_user
    ORDER BY (gm.role = 'admin') DESC, gm.joined_at ASC LIMIT 1;
    IF v_next IS NOT NULL THEN
      UPDATE public.gym_members SET role = 'owner'
      WHERE gym_id = v_gym AND user_id = v_next;
    END IF;
  END IF;

  DELETE FROM public.gym_members WHERE gym_id = v_gym AND user_id = v_user;
  -- si era profesor, quitar también su ficha (existe desde v2_gyms_trainers.sql)
  DELETE FROM public.gym_trainers WHERE gym_id = v_gym AND user_id = v_user;
  UPDATE public.users SET gym_id = NULL WHERE id = v_user AND gym_id = v_gym;
end;
$function$;

-- Gestionar miembros (solo owner/admin; el owner es intocable)
-- p_action: 'make_admin' | 'remove_admin' (solo owner) | 'remove'
CREATE OR REPLACE FUNCTION public.manage_gym_member(
  p_gym_id uuid, p_user_id uuid, p_action text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_caller uuid := auth.uid()::uuid;
  v_caller_role text;
  v_target_role text;
begin
  SELECT gm.role INTO v_caller_role FROM public.gym_members gm
  WHERE gm.gym_id = p_gym_id AND gm.user_id = v_caller;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Solo administradores del gimnasio';
  END IF;

  SELECT gm.role INTO v_target_role FROM public.gym_members gm
  WHERE gm.gym_id = p_gym_id AND gm.user_id = p_user_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'Ese usuario no es miembro'; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'No se puede modificar al dueño'; END IF;

  IF p_action = 'make_admin' THEN
    UPDATE public.gym_members SET role = 'admin'
    WHERE gym_id = p_gym_id AND user_id = p_user_id;
  ELSIF p_action = 'remove_admin' THEN
    IF v_caller_role <> 'owner' THEN RAISE EXCEPTION 'Solo el dueño puede degradar admins'; END IF;
    UPDATE public.gym_members SET role = 'member'
    WHERE gym_id = p_gym_id AND user_id = p_user_id;
  ELSIF p_action = 'remove' THEN
    DELETE FROM public.gym_members WHERE gym_id = p_gym_id AND user_id = p_user_id;
    DELETE FROM public.gym_trainers WHERE gym_id = p_gym_id AND user_id = p_user_id;
    UPDATE public.users SET gym_id = NULL WHERE id = p_user_id AND gym_id = p_gym_id;
  ELSE
    RAISE EXCEPTION 'Acción inválida: %', p_action;
  END IF;
end;
$function$;

-- VERIFICACIÓN:
-- SELECT public.is_gym_member('<gym>'), public.is_gym_admin('<gym>');
-- (como miembro logueado: true/false según rol)
