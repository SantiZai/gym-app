-- MIGRACIÓN v2 FASE 0 (2/4): profesores del gym.
-- Depende de: v2_gyms_core.sql. Independiente de routines/storage.
-- Todo idempotente. Ejecutar en SQL Editor.
--
-- Modelo: el profesor ES un usuario de la app (login con Google como todos).
-- gym_trainers vincula (gym, usuario) + especialidad + horarios. La foto y el
-- nombre salen de su perfil público (vista public_profiles: id/name/avatar_url),
-- así el perfil del gym muestra a cada profe con sus datos reales.
-- Regla v2.0: solo puede ser profesor quien sea MIEMBRO del gym
-- (users.gym_id = gym). Un usuario pertenece a un solo gym, luego solo puede
-- ser profe de su propio gym.

CREATE TABLE IF NOT EXISTS public.gym_trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  specialty text CHECK (specialty IS NULL OR char_length(specialty) <= 80),
  -- [{day: 0-6 (0=domingo), start: "08:00", end: "12:00"}]. La forma fina
  -- (start<end, sin solapes) la valida la app con zod (lib/gymSchedule).
  schedule jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(schedule) = 'array'),
  created_at timestamptz DEFAULT now(),
  UNIQUE (gym_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_gym_trainers_gym ON public.gym_trainers(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_trainers_user ON public.gym_trainers(user_id);

ALTER TABLE public.gym_trainers ENABLE ROW LEVEL SECURITY;

-- Lectura pública (el perfil del gym la muestra a cualquier logueado)
DROP POLICY IF EXISTS "gym_trainers_select" ON public.gym_trainers;
CREATE POLICY "gym_trainers_select" ON public.gym_trainers FOR SELECT USING (true);

-- Escritura solo admins del gym
DROP POLICY IF EXISTS "gym_trainers_admin_write" ON public.gym_trainers;
CREATE POLICY "gym_trainers_admin_write" ON public.gym_trainers FOR ALL
USING (public.is_gym_admin(gym_id))
WITH CHECK (public.is_gym_admin(gym_id));

-- Alta/baja de profesores (solo owner/admin).
-- p_action: 'add' (crea o actualiza especialidad/horarios) | 'remove'.
-- El objetivo debe ser miembro del gym; al remover sigue siendo miembro.
CREATE OR REPLACE FUNCTION public.manage_gym_trainer(
  p_gym_id uuid,
  p_user_id uuid,
  p_action text,
  p_specialty text DEFAULT NULL,
  p_schedule jsonb DEFAULT '[]'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
begin
  IF NOT public.is_gym_admin(p_gym_id) THEN
    RAISE EXCEPTION 'Solo administradores del gimnasio';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_members gm
    WHERE gm.gym_id = p_gym_id AND gm.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Solo un miembro del gimnasio puede ser profesor';
  END IF;

  IF p_action = 'add' THEN
    IF p_schedule IS NULL OR jsonb_typeof(p_schedule) <> 'array' THEN
      RAISE EXCEPTION 'Horarios inválidos';
    END IF;
    INSERT INTO public.gym_trainers(gym_id, user_id, specialty, schedule)
    VALUES (p_gym_id, p_user_id, NULLIF(p_specialty, ''), p_schedule)
    ON CONFLICT (gym_id, user_id)
    DO UPDATE SET specialty = EXCLUDED.specialty, schedule = EXCLUDED.schedule;
  ELSIF p_action = 'remove' THEN
    DELETE FROM public.gym_trainers WHERE gym_id = p_gym_id AND user_id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Acción inválida: %', p_action;
  END IF;
end;
$function$;

-- VERIFICACIÓN (perfil del gym: profes con datos públicos):
-- SELECT t.specialty, t.schedule, p.name, p.avatar_url
-- FROM public.gym_trainers t
-- JOIN public.public_profiles p ON p.id = t.user_id
-- WHERE t.gym_id = '<gym>';
