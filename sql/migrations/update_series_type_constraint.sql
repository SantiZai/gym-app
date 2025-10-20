-- Migración: Actualizar constraint de tipo de serie
-- Esta migración actualiza los tipos permitidos para series a 'warm-up','normal','dropset','otro'

-- Primero, eliminamos la constraint existente si existe
ALTER TABLE public.series DROP CONSTRAINT IF EXISTS series_type_check;

-- Agregamos la nueva constraint con los tipos actualizados
ALTER TABLE public.series 
ADD CONSTRAINT series_type_check CHECK (type IN ('warm-up', 'normal', 'dropset', 'otro'));

-- Actualizar registros existentes si tienen tipos antiguos que no están en la nueva constraint
-- (opcional: si hay datos en producción)
-- UPDATE public.series SET type = 'normal' WHERE type NOT IN ('warm-up', 'normal', 'dropset', 'otro');
