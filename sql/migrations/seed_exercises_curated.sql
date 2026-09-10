-- MIGRACIÓN: Reemplazar catálogo por ejercicios curados en español.
-- Generado por scripts/build-exercise-seed.mjs desde ejercicios_gimnasio.json
-- (31 ejercicios). NO EDITAR A MANO: regenerar.
--
-- QUÉ HACE (todo en una transacción = todo o nada):
-- 1) Desvincula el historial (session_series conserva pesos/reps/fechas,
--    solo pierde el puntero al ejercicio viejo).
-- 2) Borra planificaciones (series) y composiciones (routine_exercises).
--    ⚠️ Las rutinas QUEDAN VACÍAS (conservan nombre/descripción).
--    Volvé a cargarlas con plantillas o a mano.
-- 3) Borra el catálogo inglés e inserta el curado.
--
-- PREVIAMENTE: backup (Supabase → Database → Backups) y avisar a usuarios.
-- OBSOLETA translate_exercises_es.sql (no correr: ya no hay nombres ingleses).
-- Ejecutar en SQL Editor.

BEGIN;

-- 1) Preservar historial pase lo que pase con las FKs
UPDATE public.session_series SET exercise_id = NULL WHERE exercise_id IS NOT NULL;
UPDATE public.session_series SET serie_id = NULL WHERE serie_id IS NOT NULL;

-- 2) y 3) Vaciar planificaciones y composiciones
DELETE FROM public.series;
DELETE FROM public.routine_exercises;

-- 4) Vaciar catálogo viejo
DELETE FROM public.exercises;

-- 5) Catálogo curado
INSERT INTO public.exercises (name, muscle, type, equipment, instructions, origin)
VALUES
('Press de banca', 'Pecho', 'Fuerza', 'Barra Banco plano', 'Acuestate en el banco con la espalda apoyada, toma la barra con las manos a la anchura de los hombros y empujala hacia arriba hasta estirar completamente los brazos.

Variantes: Press de banca con mancuernas Press inclinado
También conocido como: Press de pecho', 'curated'),
('Flexiones de brazos', 'Pecho', 'Fuerza Resistencia', 'Sin equipo', 'Colocate en posicion de plancha con las manos apoyadas en el suelo y los brazos extendidos; baja el cuerpo hasta casi tocar el suelo con el pecho y empuja hacia arriba manteniendo la espalda recta.

Variantes: Flexion con rodillas apoyadas Flexion diamante
También conocido como: Lagartijas', 'curated'),
('Aperturas con mancuernas en banco plano', 'Pecho', 'Fuerza', 'Mancuernas Banco plano', 'Acuestate boca arriba en un banco plano sosteniendo una mancuerna en cada mano; abre los brazos lateralmente con los codos levemente flexionados hasta sentir el estiramiento en el pecho y luego vuelve a la posicion inicial.

Variantes: Aperturas en banco inclinado Aperturas en banco declinado
También conocido como: Fly con mancuernas', 'curated'),
('Cruce de poleas (crossover)', 'Pecho', 'Fuerza', 'Polea', 'De pie en medio de la maquina de poleas ajustadas arriba, toma las manillas con cada mano y, con brazos extendidos, cruza los brazos frente a tu pecho realizando una contraccion pectoral.', 'curated'),
('Dominadas', 'Espalda', 'Fuerza', 'Barra fija', 'Tomate de una barra con agarre prono mas ancho que los hombros y eleva el cuerpo hasta que la barbilla supere la altura de la barra, luego baja controladamente.

Variantes: Dominadas con agarre supino
También conocido como: Pull-up', 'curated'),
('Remo con barra', 'Espalda', 'Fuerza', 'Barra', 'De pie con la espalda recta, flexiona ligeramente las rodillas y baja el torso hacia adelante; sujeta la barra y tira de ella hacia el abdomen manteniendo los codos cerca del cuerpo.

Variantes: Remo con barra T Remo invertido con barra', 'curated'),
('Remo con mancuerna a un brazo', 'Espalda', 'Fuerza', 'Mancuernas Banco plano', 'Apoya una rodilla y mano en un banco plano, manteniendo la espalda recta; con la otra mano, sujeta una mancuerna y remala hacia arriba hasta que el codo llegue al torso.
También conocido como: Remo unilateral con mancuerna', 'curated'),
('Peso muerto rumano', 'Espalda', 'Fuerza', 'Barra', 'De pie con la barra en las manos, manten la espalda recta, flexiona muy ligeramente las rodillas y desliza la barra hacia abajo por las piernas hasta sentir el estiramiento en isquiotibiales; vuelve a subir.

Variantes: Peso muerto con piernas rigidas', 'curated'),
('Jalon al pecho en polea alta', 'Espalda', 'Fuerza', 'Polea alta Barra', 'Sentado frente a la maquina de poleas, sujeta la barra con agarre amplio; jala la barra hacia el pecho manteniendo el torso erguido.

Variantes: Jalon tras la nuca', 'curated'),
('Press militar con barra', 'Hombros', 'Fuerza', 'Barra Banco', 'Sentado o de pie, toma la barra a la altura de los hombros con las manos un poco mas alla de la anchura de los hombros; empuja hacia arriba y regresa controladamente.

Variantes: Press con mancuernas sentado
También conocido como: Press militar sentado', 'curated'),
('Elevaciones laterales con mancuernas', 'Hombros', 'Fuerza', 'Mancuernas', 'De pie, con la espalda recta, sosten una mancuerna en cada mano; eleva los brazos hacia los lados hasta la altura de los hombros y baja lentamente.', 'curated'),
('Elevaciones frontales con mancuernas', 'Hombros', 'Fuerza', 'Mancuernas', 'De pie con la espalda recta, sosten una mancuerna en cada mano; eleva los brazos hacia adelante hasta la altura de los hombros y baja lentamente.', 'curated'),
('Remo al menton con barra', 'Hombros', 'Fuerza', 'Barra', 'De pie, toma la barra al frente y elevala hacia el menton manteniendo los codos hacia arriba y separados.

Variantes: Remo al menton con mancuernas
También conocido como: Remo alto con barra', 'curated'),
('Curl de biceps con mancuernas', 'Brazos', 'Fuerza', 'Mancuernas', 'De pie con la espalda recta, sosten una mancuerna en cada mano; flexiona los codos llevando las mancuernas hacia los hombros y baja controladamente.

Variantes: Curl alterno Curl martillo
También conocido como: Curl de biceps alterno', 'curated'),
('Curl de biceps con barra EZ', 'Brazos', 'Fuerza', 'Barra EZ', 'De pie con la espalda recta, agarra la barra EZ con las manos en semisupinacion; flexiona los codos llevando la barra hacia los hombros y baja lentamente.', 'curated'),
('Extension de triceps en polea alta', 'Brazos', 'Fuerza', 'Polea Cuerda', 'De pie frente a la polea alta, sujeta la cuerda y extiende los antebrazos hacia abajo hasta estirar completamente los codos.

Variantes: Patada de triceps con mancuerna', 'curated'),
('Fondos en paralelas', 'Brazos', 'Fuerza', 'Paralelas', 'Apoyate en las barras paralelas con los brazos extendidos; baja el cuerpo flexionando los codos y empuja para volver a la posicion inicial.
También conocido como: Dips en paralelas', 'curated'),
('Sentadilla', 'Piernas', 'Fuerza', 'Barra Soportes para barra', 'Con la barra apoyada en la parte superior de la espalda, desciende flexionando rodillas y caderas manteniendo la espalda estable; vuelve a subir.

Variantes: Sentadilla frontal Sentadilla sumo
También conocido como: Squat', 'curated'),
('Prensa de piernas', 'Piernas', 'Fuerza', 'Maquina prensa', 'Sentado en la maquina, empuja la plataforma con las piernas hasta extender las rodillas sin bloquearlas y regresa lentamente.

Variantes: Prensa inclinada Prensa horizontal', 'curated'),
('Zancadas (estocadas) con mancuernas', 'Piernas', 'Fuerza', 'Mancuernas', 'Da un paso hacia adelante y flexiona ambas rodillas hasta acercar la rodilla trasera al suelo; vuelve y alterna las piernas.

Variantes: Zancada inversa Zancada lateral
También conocido como: Estocada', 'curated'),
('Peso muerto convencional', 'Piernas', 'Fuerza', 'Barra', 'Con la barra en el suelo, flexiona caderas y rodillas para sujetarla; levantala extendiendo caderas y rodillas mientras mantienes la espalda estable.', 'curated'),
('Cinta de correr (trote)', 'Piernas', 'Cardio', 'Cinta de correr', 'Colocate en la cinta y ajusta la velocidad para trotar a un ritmo constante durante el tiempo deseado.
También conocido como: Trote en cinta', 'curated'),
('Hip thrust (empuje de cadera)', 'Glúteos', 'Fuerza', 'Barra Banco', 'Con la parte alta de la espalda apoyada en un banco y la barra sobre las caderas, empuja la pelvis hacia arriba hasta extender la cadera y contrae los gluteos.

Variantes: Puente de gluteo Elevacion de cadera en suelo', 'curated'),
('Patada de gluteo en polea', 'Glúteos', 'Fuerza', 'Polea Tobillera', 'Sujeta la tobillera a la polea baja y extiende la pierna hacia atras contrayendo el gluteo; regresa lentamente.', 'curated'),
('Puente de gluteo con peso', 'Glúteos', 'Fuerza', 'Barra', 'Acostado boca arriba con las rodillas flexionadas y una barra sobre las caderas, eleva la pelvis hasta alinear el tronco y contrae los gluteos; baja lentamente.
También conocido como: Puente de cadera', 'curated'),
('Plancha', 'Core', 'Fuerza Equilibrio', 'Sin equipo', 'Apoyate sobre antebrazos y puntas de los pies, manteniendo el cuerpo en linea recta; contrae el abdomen y manten la posicion.

Variantes: Plancha lateral', 'curated'),
('Crunch abdominal', 'Core', 'Fuerza', 'Sin equipo', 'Acostado boca arriba con las rodillas flexionadas, eleva ligeramente el torso mediante la contraccion abdominal y baja con control.

Variantes: Crunch inverso
También conocido como: Abdominal', 'curated'),
('Crunch inverso en banco inclinado', 'Core', 'Fuerza', 'Banco inclinado', 'Acostado en un banco inclinado, sujeta los agarres y contrae el abdomen para elevar las piernas hacia el torso.', 'curated'),
('Superman', 'Core', 'Fuerza', 'Sin equipo', 'Acostado boca abajo, eleva simultaneamente brazos, pecho y piernas unos centimetros del suelo; manten brevemente y baja con control.', 'curated'),
('Elevacion de talon de pie', 'Gemelos', 'Fuerza Equilibrio', 'Sin equipo', 'De pie, eleva los talones del suelo contrayendo los gemelos y baja lentamente hasta apoyar los pies.

Variantes: Elevacion de talon en escalon', 'curated'),
('Elevacion de talon sentado', 'Gemelos', 'Fuerza', 'Silla o banco', 'Sentado con las rodillas flexionadas, eleva los talones manteniendo las puntas de los pies apoyadas y baja lentamente.', 'curated');

COMMIT;

-- VERIFICACIÓN: debe devolver 31
-- SELECT count(*) FROM public.exercises WHERE origin = 'curated';
