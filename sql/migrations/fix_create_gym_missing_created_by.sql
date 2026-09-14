-- MIGRACIÓN: fix create_gym — INSERT has more target columns than expressions (42601).
-- Causa: el INSERT listaba 9 columnas (incluye created_by) pero VALUES tenía
-- solo 8 expresiones (faltaba v_user). Se agrega v_user como created_by.
-- CREATE OR REPLACE conserva los GRANTs existentes. Ejecutar en SQL Editor.

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
  IF EXISTS (SELECT 1 FROM public.gyms g WHERE g.created_by = v_user) THEN
    RAISE EXCEPTION 'Ya creaste un gimnasio (máximo 1 por usuario)';
  END IF;

  INSERT INTO public.gyms(name, description, phone, email, instagram, website, address, maps_url, created_by)
  VALUES (p_name, NULLIF(p_description, ''), NULLIF(p_phone, ''), NULLIF(p_email, ''),
          NULLIF(p_instagram, ''), NULLIF(p_website, ''), NULLIF(p_address, ''), NULLIF(p_maps_url, ''), v_user)
  RETURNING id INTO v_gym;

  INSERT INTO public.gym_members(gym_id, user_id, role)
  VALUES (v_gym, v_user, 'owner')
  ON CONFLICT DO NOTHING;

  UPDATE public.users SET gym_id = v_gym WHERE id = v_user;
  RETURN v_gym;
end;
$function$;

-- VERIFICACIÓN: crear un gimnasio desde /gimnasios/nuevo debe devolver el uuid
-- en vez de: INSERT has more target columns than expressions (42601).
