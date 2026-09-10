-- MIGRACIÓN: Objetivo del usuario (se muestra y edita en /perfil)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS goal text;
