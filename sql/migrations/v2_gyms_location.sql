-- MIGRACIÓN v2 FASE 1b: ubicación obligatoria del gimnasio.
-- Todo idempotente. Ejecutar en SQL Editor después de v2_gyms_phase1.sql.
--
-- La dirección pasa a ser obligatoria (se muestra un mapita en el perfil).
-- Se exige en:
-- 1) create_gym(): raise si p_address vacío.
-- 2) Trigger validate_gym_location antes de INSERT/UPDATE: impide guardar
--    gyms sin address (>= 3 caracteres). Las filas viejas sin dirección
--    siguen existiendo hasta que se editen (ahí se les exige).

CREATE OR REPLACE FUNCTION public.validate_gym_location()
RETURNS trigger LANGUAGE plpgsql AS $function$
begin
  IF coalesce(trim(NEW.address), '') = '' OR char_length(trim(NEW.address)) < 3 THEN
    RAISE EXCEPTION 'La ubicación del gimnasio es obligatoria (dirección)';
  END IF;
  RETURN NEW;
end;
$function$;

DROP TRIGGER IF EXISTS trg_gyms_require_location ON public.gyms;
CREATE TRIGGER trg_gyms_require_location
BEFORE INSERT OR UPDATE OF address ON public.gyms
FOR EACH ROW EXECUTE PROCEDURE public.validate_gym_location();

-- create_gym con dirección obligatoria (mantiene el fix created_by).
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

-- VERIFICACIÓN:
-- INSERT INTO public.gyms(name, created_by) VALUES ('Sin dirección', auth.uid())
-- → debe fallar con "La ubicación del gimnasio es obligatoria".
