-- MIGRACIÓN: Reemplazar catálogo por ejercicios curados con músculo preciso.
-- Generado por scripts/build-exercise-seed.mjs desde ejercicios_gimnasio.json
-- (73 ejercicios). NO EDITAR A MANO: regenerar.
--
-- REQUIERE: muscles_catalog.sql aplicado (tabla muscles + columnas nuevas).
-- QUÉ HACE (todo en una transacción = todo o nada):
-- 1) Desvincula el historial (session_series conserva pesos/reps/fechas,
--    solo pierde el puntero al ejercicio viejo).
-- 2) Borra planificaciones (series) y composiciones (routine_exercises).
--    ⚠️ Las rutinas QUEDAN VACÍAS (conservan nombre/descripción).
--    Volvé a cargarlas con plantillas o a mano.
-- 3) Borra el catálogo e inserta el curado con músculo principal + secundarios.
--
-- PREVIAMENTE: backup (Supabase → Database → Backups) y avisar a usuarios.
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

-- 5) Catálogo curado con músculo preciso
INSERT INTO public.exercises (name, primary_muscle_id, secondary_muscle_ids, type, equipment, instructions, origin)
VALUES
('Press de banca', 'pectoral', array['triceps', 'deltoides-anterior'], 'Fuerza', 'Barra Banco plano', 'Acuestate en el banco con la espalda apoyada, toma la barra con las manos a la anchura de los hombros y empujala hacia arriba hasta estirar completamente los brazos.
También conocido como: Press de pecho', 'curated'),
('Press de banca con mancuernas', 'pectoral', array['triceps', 'deltoides-anterior'], 'Fuerza', 'Barra Banco plano', 'Acuestate en el banco con la espalda apoyada, toma la barra con las manos a la anchura de los hombros y empujala hacia arriba hasta estirar completamente los brazos.
Variante de: Press de banca', 'curated-variant'),
('Press inclinado', 'pectoral', array['triceps', 'deltoides-anterior'], 'Fuerza', 'Barra Banco plano', 'Acuestate en el banco con la espalda apoyada, toma la barra con las manos a la anchura de los hombros y empujala hacia arriba hasta estirar completamente los brazos.
Variante de: Press de banca', 'curated-variant'),
('Flexiones de brazos', 'pectoral', array['triceps', 'deltoides-anterior'], 'Fuerza Resistencia', 'Sin equipo', 'Colocate en posicion de plancha con las manos apoyadas en el suelo y los brazos extendidos; baja el cuerpo hasta casi tocar el suelo con el pecho y empuja hacia arriba manteniendo la espalda recta.
También conocido como: Lagartijas', 'curated'),
('Flexion con rodillas apoyadas', 'pectoral', array['triceps', 'deltoides-anterior'], 'Fuerza Resistencia', 'Sin equipo', 'Colocate en posicion de plancha con las manos apoyadas en el suelo y los brazos extendidos; baja el cuerpo hasta casi tocar el suelo con el pecho y empuja hacia arriba manteniendo la espalda recta.
Variante de: Flexiones de brazos', 'curated-variant'),
('Flexion diamante', 'pectoral', array['triceps', 'deltoides-anterior'], 'Fuerza Resistencia', 'Sin equipo', 'Colocate en posicion de plancha con las manos apoyadas en el suelo y los brazos extendidos; baja el cuerpo hasta casi tocar el suelo con el pecho y empuja hacia arriba manteniendo la espalda recta.
Variante de: Flexiones de brazos', 'curated-variant'),
('Aperturas con mancuernas en banco plano', 'pectoral', array['deltoides-anterior'], 'Fuerza', 'Mancuernas Banco plano', 'Acuestate boca arriba en un banco plano sosteniendo una mancuerna en cada mano; abre los brazos lateralmente con los codos levemente flexionados hasta sentir el estiramiento en el pecho y luego vuelve a la posicion inicial.
También conocido como: Fly con mancuernas', 'curated'),
('Aperturas en banco inclinado', 'pectoral', array['deltoides-anterior'], 'Fuerza', 'Mancuernas Banco plano', 'Acuestate boca arriba en un banco plano sosteniendo una mancuerna en cada mano; abre los brazos lateralmente con los codos levemente flexionados hasta sentir el estiramiento en el pecho y luego vuelve a la posicion inicial.
Variante de: Aperturas con mancuernas en banco plano', 'curated-variant'),
('Aperturas en banco declinado', 'pectoral', array['deltoides-anterior'], 'Fuerza', 'Mancuernas Banco plano', 'Acuestate boca arriba en un banco plano sosteniendo una mancuerna en cada mano; abre los brazos lateralmente con los codos levemente flexionados hasta sentir el estiramiento en el pecho y luego vuelve a la posicion inicial.
Variante de: Aperturas con mancuernas en banco plano', 'curated-variant'),
('Cruce de poleas (crossover)', 'pectoral', array['deltoides-anterior'], 'Fuerza', 'Polea', 'De pie en medio de la maquina de poleas ajustadas arriba, toma las manillas con cada mano y, con brazos extendidos, cruza los brazos frente a tu pecho realizando una contraccion pectoral.', 'curated'),
('Dominadas', 'dorsal', array['biceps', 'trapecio'], 'Fuerza', 'Barra fija', 'Tomate de una barra con agarre prono mas ancho que los hombros y eleva el cuerpo hasta que la barbilla supere la altura de la barra, luego baja controladamente.
También conocido como: Pull-up', 'curated'),
('Dominadas con agarre supino', 'dorsal', array['biceps', 'trapecio'], 'Fuerza', 'Barra fija', 'Tomate de una barra con agarre prono mas ancho que los hombros y eleva el cuerpo hasta que la barbilla supere la altura de la barra, luego baja controladamente.
Variante de: Dominadas', 'curated-variant'),
('Remo con barra', 'dorsal', array['trapecio', 'biceps'], 'Fuerza', 'Barra', 'De pie con la espalda recta, flexiona ligeramente las rodillas y baja el torso hacia adelante; sujeta la barra y tira de ella hacia el abdomen manteniendo los codos cerca del cuerpo.', 'curated'),
('Remo con barra T', 'dorsal', array['trapecio', 'biceps'], 'Fuerza', 'Barra', 'De pie con la espalda recta, flexiona ligeramente las rodillas y baja el torso hacia adelante; sujeta la barra y tira de ella hacia el abdomen manteniendo los codos cerca del cuerpo.
Variante de: Remo con barra', 'curated-variant'),
('Remo invertido con barra', 'dorsal', array['trapecio', 'biceps'], 'Fuerza', 'Barra', 'De pie con la espalda recta, flexiona ligeramente las rodillas y baja el torso hacia adelante; sujeta la barra y tira de ella hacia el abdomen manteniendo los codos cerca del cuerpo.
Variante de: Remo con barra', 'curated-variant'),
('Remo con mancuerna a un brazo', 'dorsal', array['trapecio', 'biceps'], 'Fuerza', 'Mancuernas Banco plano', 'Apoya una rodilla y mano en un banco plano, manteniendo la espalda recta; con la otra mano, sujeta una mancuerna y remala hacia arriba hasta que el codo llegue al torso.
También conocido como: Remo unilateral con mancuerna', 'curated'),
('Peso muerto rumano', 'isquiotibiales', array['gluteos', 'lumbares'], 'Fuerza', 'Barra', 'De pie con la barra en las manos, manten la espalda recta, flexiona muy ligeramente las rodillas y desliza la barra hacia abajo por las piernas hasta sentir el estiramiento en isquiotibiales; vuelve a subir.', 'curated'),
('Peso muerto con piernas rigidas', 'isquiotibiales', array['gluteos', 'lumbares'], 'Fuerza', 'Barra', 'De pie con la barra en las manos, manten la espalda recta, flexiona muy ligeramente las rodillas y desliza la barra hacia abajo por las piernas hasta sentir el estiramiento en isquiotibiales; vuelve a subir.
Variante de: Peso muerto rumano', 'curated-variant'),
('Jalon al pecho en polea alta', 'dorsal', array['biceps', 'trapecio'], 'Fuerza', 'Polea alta Barra', 'Sentado frente a la maquina de poleas, sujeta la barra con agarre amplio; jala la barra hacia el pecho manteniendo el torso erguido.', 'curated'),
('Jalon tras la nuca', 'dorsal', array['biceps', 'trapecio'], 'Fuerza', 'Polea alta Barra', 'Sentado frente a la maquina de poleas, sujeta la barra con agarre amplio; jala la barra hacia el pecho manteniendo el torso erguido.
Variante de: Jalon al pecho en polea alta', 'curated-variant'),
('Remo en maquina', 'dorsal', array['biceps'], 'Fuerza', 'Maquina de remo', 'Ajusta el asiento y el pecho a la maquina, toma los agarres y tira de ellos hacia el torso llevando los codos hacia atras; regresa lentamente sin perder la tension.
También conocido como: Remo sentado en maquina Remo de espalda en maquina Seated machine row', 'curated'),
('Remo en maquina con agarre neutro', 'dorsal', array['biceps'], 'Fuerza', 'Maquina de remo', 'Ajusta el asiento y el pecho a la maquina, toma los agarres y tira de ellos hacia el torso llevando los codos hacia atras; regresa lentamente sin perder la tension.
Variante de: Remo en maquina', 'curated-variant'),
('Remo en maquina con agarre amplio', 'dorsal', array['biceps'], 'Fuerza', 'Maquina de remo', 'Ajusta el asiento y el pecho a la maquina, toma los agarres y tira de ellos hacia el torso llevando los codos hacia atras; regresa lentamente sin perder la tension.
Variante de: Remo en maquina', 'curated-variant'),
('Remo en maquina unilateral', 'dorsal', array['biceps'], 'Fuerza', 'Maquina de remo', 'Ajusta el asiento y el pecho a la maquina, toma los agarres y tira de ellos hacia el torso llevando los codos hacia atras; regresa lentamente sin perder la tension.
Variante de: Remo en maquina', 'curated-variant'),
('Pullover', 'dorsal', array['pectoral', 'triceps'], 'Fuerza', 'Mancuerna Banco plano', 'Acuestate sobre un banco sosteniendo una mancuerna sobre el pecho con los brazos ligeramente flexionados; baja el peso por detras de la cabeza mediante el movimiento de los hombros y vuelve a la posicion inicial.
También conocido como: Pullover con mancuerna Dumbbell pullover', 'curated'),
('Pullover con barra', 'dorsal', array['pectoral', 'triceps'], 'Fuerza', 'Mancuerna Banco plano', 'Acuestate sobre un banco sosteniendo una mancuerna sobre el pecho con los brazos ligeramente flexionados; baja el peso por detras de la cabeza mediante el movimiento de los hombros y vuelve a la posicion inicial.
Variante de: Pullover', 'curated-variant'),
('Pullover en polea', 'dorsal', array['pectoral', 'triceps'], 'Fuerza', 'Mancuerna Banco plano', 'Acuestate sobre un banco sosteniendo una mancuerna sobre el pecho con los brazos ligeramente flexionados; baja el peso por detras de la cabeza mediante el movimiento de los hombros y vuelve a la posicion inicial.
Variante de: Pullover', 'curated-variant'),
('Pullover en maquina', 'dorsal', array['pectoral', 'triceps'], 'Fuerza', 'Mancuerna Banco plano', 'Acuestate sobre un banco sosteniendo una mancuerna sobre el pecho con los brazos ligeramente flexionados; baja el peso por detras de la cabeza mediante el movimiento de los hombros y vuelve a la posicion inicial.
Variante de: Pullover', 'curated-variant'),
('Press militar con barra', 'deltoides-anterior', array['triceps', 'deltoides-medio'], 'Fuerza', 'Barra Banco', 'Sentado o de pie, toma la barra a la altura de los hombros con las manos un poco mas alla de la anchura de los hombros; empuja hacia arriba y regresa controladamente.
También conocido como: Press militar sentado', 'curated'),
('Press con mancuernas sentado', 'deltoides-anterior', array['triceps', 'deltoides-medio'], 'Fuerza', 'Barra Banco', 'Sentado o de pie, toma la barra a la altura de los hombros con las manos un poco mas alla de la anchura de los hombros; empuja hacia arriba y regresa controladamente.
Variante de: Press militar con barra', 'curated-variant'),
('Elevaciones laterales con mancuernas', 'deltoides-medio', '{}', 'Fuerza', 'Mancuernas', 'De pie, con la espalda recta, sosten una mancuerna en cada mano; eleva los brazos hacia los lados hasta la altura de los hombros y baja lentamente.', 'curated'),
('Elevaciones frontales con mancuernas', 'deltoides-anterior', '{}', 'Fuerza', 'Mancuernas', 'De pie con la espalda recta, sosten una mancuerna en cada mano; eleva los brazos hacia adelante hasta la altura de los hombros y baja lentamente.', 'curated'),
('Remo al menton con barra', 'deltoides-medio', array['trapecio', 'biceps'], 'Fuerza', 'Barra', 'De pie, toma la barra al frente y elevala hacia el menton manteniendo los codos hacia arriba y separados.
También conocido como: Remo alto con barra', 'curated'),
('Remo al menton con mancuernas', 'deltoides-medio', array['trapecio', 'biceps'], 'Fuerza', 'Barra', 'De pie, toma la barra al frente y elevala hacia el menton manteniendo los codos hacia arriba y separados.
Variante de: Remo al menton con barra', 'curated-variant'),
('Curl de biceps con mancuernas', 'biceps', '{}', 'Fuerza', 'Mancuernas', 'De pie con la espalda recta, sosten una mancuerna en cada mano; flexiona los codos llevando las mancuernas hacia los hombros y baja controladamente.
También conocido como: Curl de biceps alterno', 'curated'),
('Curl alterno', 'biceps', '{}', 'Fuerza', 'Mancuernas', 'De pie con la espalda recta, sosten una mancuerna en cada mano; flexiona los codos llevando las mancuernas hacia los hombros y baja controladamente.
Variante de: Curl de biceps con mancuernas', 'curated-variant'),
('Curl martillo', 'biceps', '{}', 'Fuerza', 'Mancuernas', 'De pie con la espalda recta, sosten una mancuerna en cada mano; flexiona los codos llevando las mancuernas hacia los hombros y baja controladamente.
Variante de: Curl de biceps con mancuernas', 'curated-variant'),
('Curl de biceps con barra EZ', 'biceps', '{}', 'Fuerza', 'Barra EZ', 'De pie con la espalda recta, agarra la barra EZ con las manos en semisupinacion; flexiona los codos llevando la barra hacia los hombros y baja lentamente.', 'curated'),
('Extension de triceps en polea alta', 'triceps', '{}', 'Fuerza', 'Polea Cuerda', 'De pie frente a la polea alta, sujeta la cuerda y extiende los antebrazos hacia abajo hasta estirar completamente los codos.', 'curated'),
('Patada de triceps con mancuerna', 'triceps', '{}', 'Fuerza', 'Polea Cuerda', 'De pie frente a la polea alta, sujeta la cuerda y extiende los antebrazos hacia abajo hasta estirar completamente los codos.
Variante de: Extension de triceps en polea alta', 'curated-variant'),
('Fondos en paralelas', 'triceps', array['pectoral', 'deltoides-anterior'], 'Fuerza', 'Paralelas', 'Apoyate en las barras paralelas con los brazos extendidos; baja el cuerpo flexionando los codos y empuja para volver a la posicion inicial.
También conocido como: Dips en paralelas', 'curated'),
('Curl Scott', 'biceps', array['antebrazo'], 'Fuerza', 'Banco Scott Barra EZ', 'Sientate en el banco Scott con la parte posterior de los brazos apoyada en el almohadon; flexiona los codos para llevar la barra hacia los hombros y baja lentamente sin despegar los brazos.
También conocido como: Curl predicador Preacher curl Curl de biceps Scott', 'curated'),
('Curl Scott con barra recta', 'biceps', array['antebrazo'], 'Fuerza', 'Banco Scott Barra EZ', 'Sientate en el banco Scott con la parte posterior de los brazos apoyada en el almohadon; flexiona los codos para llevar la barra hacia los hombros y baja lentamente sin despegar los brazos.
Variante de: Curl Scott', 'curated-variant'),
('Curl Scott con mancuernas', 'biceps', array['antebrazo'], 'Fuerza', 'Banco Scott Barra EZ', 'Sientate en el banco Scott con la parte posterior de los brazos apoyada en el almohadon; flexiona los codos para llevar la barra hacia los hombros y baja lentamente sin despegar los brazos.
Variante de: Curl Scott', 'curated-variant'),
('Curl Scott en maquina', 'biceps', array['antebrazo'], 'Fuerza', 'Banco Scott Barra EZ', 'Sientate en el banco Scott con la parte posterior de los brazos apoyada en el almohadon; flexiona los codos para llevar la barra hacia los hombros y baja lentamente sin despegar los brazos.
Variante de: Curl Scott', 'curated-variant'),
('Curl martillo alterno', 'antebrazo', array['biceps'], 'Fuerza', 'Mancuernas', 'De pie con una mancuerna en cada mano y las palmas enfrentadas, manten los codos junto al cuerpo y flexionalos para subir las mancuernas hacia los hombros; baja con control.
Variante de: Curl martillo', 'curated-variant'),
('Curl martillo sentado', 'antebrazo', array['biceps'], 'Fuerza', 'Mancuernas', 'De pie con una mancuerna en cada mano y las palmas enfrentadas, manten los codos junto al cuerpo y flexionalos para subir las mancuernas hacia los hombros; baja con control.
Variante de: Curl martillo', 'curated-variant'),
('Curl martillo con cuerda en polea', 'antebrazo', array['biceps'], 'Fuerza', 'Mancuernas', 'De pie con una mancuerna en cada mano y las palmas enfrentadas, manten los codos junto al cuerpo y flexionalos para subir las mancuernas hacia los hombros; baja con control.
Variante de: Curl martillo', 'curated-variant'),
('Sentadilla', 'cuadriceps', array['gluteos', 'isquiotibiales'], 'Fuerza', 'Barra Soportes para barra', 'Con la barra apoyada en la parte superior de la espalda, desciende flexionando rodillas y caderas manteniendo la espalda estable; vuelve a subir.
También conocido como: Squat', 'curated'),
('Sentadilla frontal', 'cuadriceps', array['gluteos', 'isquiotibiales'], 'Fuerza', 'Barra Soportes para barra', 'Con la barra apoyada en la parte superior de la espalda, desciende flexionando rodillas y caderas manteniendo la espalda estable; vuelve a subir.
Variante de: Sentadilla', 'curated-variant'),
('Sentadilla sumo', 'cuadriceps', array['gluteos', 'isquiotibiales'], 'Fuerza', 'Barra Soportes para barra', 'Con la barra apoyada en la parte superior de la espalda, desciende flexionando rodillas y caderas manteniendo la espalda estable; vuelve a subir.
Variante de: Sentadilla', 'curated-variant'),
('Prensa de piernas', 'cuadriceps', array['gluteos'], 'Fuerza', 'Maquina prensa', 'Sentado en la maquina, empuja la plataforma con las piernas hasta extender las rodillas sin bloquearlas y regresa lentamente.', 'curated'),
('Prensa inclinada', 'cuadriceps', array['gluteos'], 'Fuerza', 'Maquina prensa', 'Sentado en la maquina, empuja la plataforma con las piernas hasta extender las rodillas sin bloquearlas y regresa lentamente.
Variante de: Prensa de piernas', 'curated-variant'),
('Prensa horizontal', 'cuadriceps', array['gluteos'], 'Fuerza', 'Maquina prensa', 'Sentado en la maquina, empuja la plataforma con las piernas hasta extender las rodillas sin bloquearlas y regresa lentamente.
Variante de: Prensa de piernas', 'curated-variant'),
('Zancadas (estocadas) con mancuernas', 'cuadriceps', array['isquiotibiales', 'gluteos'], 'Fuerza', 'Mancuernas', 'Da un paso hacia adelante y flexiona ambas rodillas hasta acercar la rodilla trasera al suelo; vuelve y alterna las piernas.
También conocido como: Estocada', 'curated'),
('Zancada inversa', 'cuadriceps', array['isquiotibiales', 'gluteos'], 'Fuerza', 'Mancuernas', 'Da un paso hacia adelante y flexiona ambas rodillas hasta acercar la rodilla trasera al suelo; vuelve y alterna las piernas.
Variante de: Zancadas (estocadas) con mancuernas', 'curated-variant'),
('Zancada lateral', 'cuadriceps', array['isquiotibiales', 'gluteos'], 'Fuerza', 'Mancuernas', 'Da un paso hacia adelante y flexiona ambas rodillas hasta acercar la rodilla trasera al suelo; vuelve y alterna las piernas.
Variante de: Zancadas (estocadas) con mancuernas', 'curated-variant'),
('Peso muerto convencional', 'isquiotibiales', array['gluteos', 'trapecio', 'lumbares'], 'Fuerza', 'Barra', 'Con la barra en el suelo, flexiona caderas y rodillas para sujetarla; levantala extendiendo caderas y rodillas mientras mantienes la espalda estable.', 'curated'),
('Cinta de correr (trote)', 'cuadriceps', array['gluteos', 'gemelos'], 'Cardio', 'Cinta de correr', 'Colocate en la cinta y ajusta la velocidad para trotar a un ritmo constante durante el tiempo deseado.
También conocido como: Trote en cinta', 'curated'),
('Hip thrust (empuje de cadera)', 'gluteos', array['isquiotibiales'], 'Fuerza', 'Barra Banco', 'Con la parte alta de la espalda apoyada en un banco y la barra sobre las caderas, empuja la pelvis hacia arriba hasta extender la cadera y contrae los gluteos.', 'curated'),
('Puente de gluteo', 'gluteos', array['isquiotibiales'], 'Fuerza', 'Barra Banco', 'Con la parte alta de la espalda apoyada en un banco y la barra sobre las caderas, empuja la pelvis hacia arriba hasta extender la cadera y contrae los gluteos.
Variante de: Hip thrust (empuje de cadera)', 'curated-variant'),
('Elevacion de cadera en suelo', 'gluteos', array['isquiotibiales'], 'Fuerza', 'Barra Banco', 'Con la parte alta de la espalda apoyada en un banco y la barra sobre las caderas, empuja la pelvis hacia arriba hasta extender la cadera y contrae los gluteos.
Variante de: Hip thrust (empuje de cadera)', 'curated-variant'),
('Patada de gluteo en polea', 'gluteos', array['isquiotibiales'], 'Fuerza', 'Polea Tobillera', 'Sujeta la tobillera a la polea baja y extiende la pierna hacia atras contrayendo el gluteo; regresa lentamente.', 'curated'),
('Puente de gluteo con peso', 'gluteos', array['isquiotibiales'], 'Fuerza', 'Barra', 'Acostado boca arriba con las rodillas flexionadas y una barra sobre las caderas, eleva la pelvis hasta alinear el tronco y contrae los gluteos; baja lentamente.
También conocido como: Puente de cadera', 'curated'),
('Plancha', 'abdominales', array['oblicuos', 'lumbares'], 'Fuerza Equilibrio', 'Sin equipo', 'Apoyate sobre antebrazos y puntas de los pies, manteniendo el cuerpo en linea recta; contrae el abdomen y manten la posicion.', 'curated'),
('Plancha lateral', 'abdominales', array['oblicuos', 'lumbares'], 'Fuerza Equilibrio', 'Sin equipo', 'Apoyate sobre antebrazos y puntas de los pies, manteniendo el cuerpo en linea recta; contrae el abdomen y manten la posicion.
Variante de: Plancha', 'curated-variant'),
('Crunch abdominal', 'abdominales', '{}', 'Fuerza', 'Sin equipo', 'Acostado boca arriba con las rodillas flexionadas, eleva ligeramente el torso mediante la contraccion abdominal y baja con control.
También conocido como: Abdominal', 'curated'),
('Crunch inverso', 'abdominales', '{}', 'Fuerza', 'Sin equipo', 'Acostado boca arriba con las rodillas flexionadas, eleva ligeramente el torso mediante la contraccion abdominal y baja con control.
Variante de: Crunch abdominal', 'curated-variant'),
('Crunch inverso en banco inclinado', 'abdominales', '{}', 'Fuerza', 'Banco inclinado', 'Acostado en un banco inclinado, sujeta los agarres y contrae el abdomen para elevar las piernas hacia el torso.', 'curated'),
('Superman', 'lumbares', array['gluteos'], 'Fuerza', 'Sin equipo', 'Acostado boca abajo, eleva simultaneamente brazos, pecho y piernas unos centimetros del suelo; manten brevemente y baja con control.', 'curated'),
('Elevacion de talon de pie', 'gemelos', '{}', 'Fuerza Equilibrio', 'Sin equipo', 'De pie, eleva los talones del suelo contrayendo los gemelos y baja lentamente hasta apoyar los pies.', 'curated'),
('Elevacion de talon en escalon', 'gemelos', '{}', 'Fuerza Equilibrio', 'Sin equipo', 'De pie, eleva los talones del suelo contrayendo los gemelos y baja lentamente hasta apoyar los pies.
Variante de: Elevacion de talon de pie', 'curated-variant'),
('Elevacion de talon sentado', 'gemelos', '{}', 'Fuerza', 'Silla o banco', 'Sentado con las rodillas flexionadas, eleva los talones manteniendo las puntas de los pies apoyadas y baja lentamente.', 'curated');

COMMIT;

-- VERIFICACIÓN: debe devolver 73
-- SELECT count(*) FROM public.exercises WHERE origin LIKE 'curated%';
