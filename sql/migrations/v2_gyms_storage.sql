-- MIGRACIÓN v2 FASE 0 (4/4): bucket para logos del gym.
-- Depende de: v2_gyms_core.sql (usa is_gym_admin). Independiente del resto.
-- Todo idempotente. Ejecutar en SQL Editor.
--
-- Convención de paths: logos/{gym_id}/... (la app sube y borra el anterior
-- al reemplazar). Los profesores usan su avatar de Google (users.avatar_url),
-- no necesitan storage.

INSERT INTO storage.buckets (id, name, public)
VALUES ('gym-logos', 'gym-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública (logos visibles en directorio y perfil del gym)
DROP POLICY IF EXISTS "gym-logos public read" ON storage.objects;
CREATE POLICY "gym-logos public read" ON storage.objects FOR SELECT
USING (bucket_id = 'gym-logos');

-- Escritura solo admins del gym dueño de la carpeta
DROP POLICY IF EXISTS "gym-logos admin insert" ON storage.objects;
CREATE POLICY "gym-logos admin insert" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'gym-logos'
  AND public.is_gym_admin((storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "gym-logos admin update" ON storage.objects;
CREATE POLICY "gym-logos admin update" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'gym-logos'
  AND public.is_gym_admin((storage.foldername(name))[1]::uuid)
)
WITH CHECK (
  bucket_id = 'gym-logos'
  AND public.is_gym_admin((storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "gym-logos admin delete" ON storage.objects;
CREATE POLICY "gym-logos admin delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'gym-logos'
  AND public.is_gym_admin((storage.foldername(name))[1]::uuid)
);

-- VERIFICACIÓN:
-- SELECT * FROM storage.buckets WHERE id = 'gym-logos';  → public = true
