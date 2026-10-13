-- PLANTILLA: alta manual de ejercicios con músculo principal + secundarios.
-- Los ids de músculo son los slugs de `public.muscles` (ver muscles_catalog.sql).
-- `secondary_muscle_ids` es opcional (array vacío si no aplica).

insert into public.exercises
  (name, primary_muscle_id, secondary_muscle_ids, type, equipment, instructions, origin)
values
  (
    'Press de banca', 'pectoral', array['triceps', 'deltoides-anterior'],
    'Fuerza', 'Barra Banco plano',
    'Acuestate en el banco con la espalda apoyada, toma la barra con las manos a la anchura de los hombros y empujala hacia arriba hasta estirar completamente los brazos.',
    'manual'
  ),
  (
    'Curl de biceps con mancuernas', 'biceps', '{}',
    'Fuerza', 'Mancuernas',
    'De pie con la espalda recta, sosten una mancuerna en cada mano; flexiona los codos llevando las mancuernas hacia los hombros y baja controladamente.',
    'manual'
  ),
  (
    'Sentadilla', 'cuadriceps', array['gluteos', 'lumbares'],
    'Fuerza', 'Barra Soportes para barra',
    'Con la barra apoyada en la parte superior de la espalda, desciende flexionando rodillas y caderas manteniendo la espalda estable; vuelve a subir.',
    'manual'
  );

-- VERIFICACIÓN:
-- select e.name, m.name as principal, e.secondary_muscle_ids
-- from public.exercises e join public.muscles m on m.id = e.primary_muscle_id;
