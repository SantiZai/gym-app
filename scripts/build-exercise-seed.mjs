// Genera sql/migrations/seed_exercises_curated.sql desde ejercicios_gimnasio.json.
// Uso: node scripts/build-exercise-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = JSON.parse(readFileSync(path.join(root, "ejercicios_gimnasio.json"), "utf8"));

const GROUP_ES = {
  pecho: "Pecho",
  espalda: "Espalda",
  hombros: "Hombros",
  brazos: "Brazos",
  piernas: "Piernas",
  gluteos: "Glúteos",
  core: "Core",
  gemelos: "Gemelos",
};

const esc = (v) => {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
};

// Varios campos del JSON son arrays: se unen con espacio ("Barra Banco plano")
const join = (v) => (Array.isArray(v) ? v.join(" ") : (v ?? ""));
const nonEmpty = (v) => {
  const s = Array.isArray(v) ? v.join(" ").trim() : String(v ?? "").trim();
  return s.length > 0 ? s : null;
};

const rows = [];
for (const [groupKey, list] of Object.entries(src.musculos)) {
  const muscle = GROUP_ES[groupKey];
  if (!muscle) throw new Error(`Grupo desconocido: ${groupKey}`);
  for (const ex of list) {
    let instructions = ex.instruccion || "";
    const variantes = nonEmpty(ex.variantes);
    const sinonimos = nonEmpty(ex.sinonimos);
    if (variantes) instructions += `\n\nVariantes: ${variantes}`;
    if (sinonimos) instructions += `\nTambién conocido como: ${sinonimos}`;
    rows.push(
      `(${esc(ex.nombre)}, ${esc(muscle)}, ${esc(join(ex.tipo))}, ${esc(join(ex.equipamiento))}, ${esc(instructions)}, 'curated')`
    );
  }
}

const sql = `-- MIGRACIÓN: Reemplazar catálogo por ejercicios curados en español.
-- Generado por scripts/build-exercise-seed.mjs desde ejercicios_gimnasio.json
-- (${rows.length} ejercicios). NO EDITAR A MANO: regenerar.
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
${rows.join(",\n")};

COMMIT;

-- VERIFICACIÓN: debe devolver ${rows.length}
-- SELECT count(*) FROM public.exercises WHERE origin = 'curated';
`;

writeFileSync(path.join(root, "sql", "migrations", "seed_exercises_curated.sql"), sql, "utf8");
console.log(`Seed generado: ${rows.length} ejercicios`);
