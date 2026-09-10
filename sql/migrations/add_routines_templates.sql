-- MIGRACIÓN: Añadir soporte para plantillas de rutinas
ALTER TABLE public.routines 
ADD COLUMN IF NOT EXISTS is_template boolean default false,
ADD COLUMN IF NOT EXISTS category text;

-- Asegurar que las plantillas pueden ser leídas por otros (opcional, si quieres compartir)
-- Por ahora mantendremos la visibilidad basada en el flag 'public' que ya existe
-- Pero aseguramos que las plantillas creadas por el sistema tengan un valor adecuado.

COMMENT ON COLUMN public.routines.is_template IS 'Identifica si la rutina es una plantilla reutilizable';
COMMENT ON COLUMN public.routines.category IS 'Categoría de la rutina (ej: Fuerza, Hipertrofia)';
