-- MIGRACIÓN v2 FASE 1c: coordenadas reales del gimnasio.
-- Todo idempotente. Ejecutar en SQL Editor después de v2_gyms_location.sql.
--
-- La dirección se elige desde un buscador de lugares reales (Nominatim/OSM)
-- y se guardan latitude/longitude para centrar el mapita con precisión.
-- create_gym acepta p_latitude/p_longitude opcionales (compat hacia atrás).

ALTER TABLE public.gyms
ADD COLUMN IF NOT EXISTS latitude double precision;

ALTER TABLE public.gyms
ADD COLUMN IF NOT EXISTS longitude double precision;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gyms_latitude_check') THEN
    ALTER TABLE public.gyms
    ADD CONSTRAINT gyms_latitude_check
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gyms_longitude_check') THEN
    ALTER TABLE public.gyms
    ADD CONSTRAINT gyms_longitude_check
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;
END $$;

-- create_gym con dirección obligatoria + coordenadas opcionales.
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
begin
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF coalesce(trim(p_name), '') = '' THEN RAISE EXCEPTION 'El nombre es requerido'; END IF;
  IF coalesce(trim(coalesce(p_address, '')), '') = '' THEN
    RAISE EXCEPTION 'La ubicación del gimnasio es obligatoria (dirección)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gyms g WHERE g.created_by = v_user) THEN
    RAISE EXCEPTION 'Ya creaste un gimnasio (máximo 1 por usuario)';
  END IF;

  INSERT INTO public.gyms(name, description, phone, email, instagram, website, address, maps_url, created_by, latitude, longitude)
  VALUES (p_name, NULLIF(p_description, ''), NULLIF(p_phone, ''), NULLIF(p_email, ''),
          NULLIF(p_instagram, ''), NULLIF(p_website, ''), NULLIF(trim(p_address), ''), NULLIF(p_maps_url, ''), v_user,
          p_latitude, p_longitude)
  RETURNING id INTO v_gym;

  INSERT INTO public.gym_members(gym_id, user_id, role)
  VALUES (v_gym, v_user, 'owner')
  ON CONFLICT DO NOTHING;

  UPDATE public.users SET gym_id = v_gym WHERE id = v_user;
  RETURN v_gym;
end;
$function$;

-- VERIFICACIÓN:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'gyms' AND column_name IN ('latitude', 'longitude');
