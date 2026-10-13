// Genera sql/migrations/seed_exercises_curated.sql desde ejercicios_gimnasio.json.
// Uso: node scripts/build-exercise-seed.mjs
// Mapea musculo_principal → primary_muscle_id y musculos_secundarios →
// secondary_muscle_ids (slugs FK a muscles).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = JSON.parse(readFileSync(path.join(root, "ejercicios_gimnasio.json"), "utf8"));

const norm = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s-]+/g, "_");

// Español preciso del JSON → slug FK a muscles
const ES_TO_MUSCLE = {
  pectoral_mayor: "pectoral",
  pectorales: "pectoral",
  dorsal_ancho: "dorsal",
  dorsales: "dorsal",
  redondo_mayor: "dorsal",
  trapecio: "trapecio",
  deltoides_anterior: "deltoides-anterior",
  deltoides_medio: "deltoides-medio",
  deltoides_lateral: "deltoides-medio",
  deltoides: "deltoides-medio",
  deltoide: "deltoides-medio",
  biceps_braquial: "biceps",
  triceps_braquial: "triceps",
  braquiorradial: "antebrazo",
  antebrazo: "antebrazo",
  recto_abdominal: "abdominales",
  abdominales: "abdominales",
  oblicuos: "oblicuos",
  erectores_espinales: "lumbares",
  cuadriceps: "cuadriceps",
  isquiotibiales: "isquiotibiales",
  isquios: "isquiotibiales",
  gluteo_mayor: "gluteos",
  gluteo: "gluteos",
  gluteos: "gluteos",
  gemelos: "gemelos",
  gemelo: "gemelos",
  soleo: "gemelos",
};

const toSlug = (v) => ES_TO_MUSCLE[norm(v)] ?? null;

const esc = (v) => {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
};

const pgArray = (slugs) =>
  slugs.length === 0 ? "'{}'" : `array[${slugs.map((s) => `'${s}'`).join(", ")}]`;

// Varios campos del JSON son arrays: se unen con espacio ("Barra Banco plano")
const join = (v) => (Array.isArray(v) ? v.join(" ") : (v ?? ""));
const nonEmpty = (v) => {
  const s = Array.isArray(v) ? v.join(" ").trim() : String(v ?? "").trim();
  return s.length > 0 ? s : null;
};

const rows = [];
const seen = new Set();
const pushRow = (name, primary, secondaries, type, equipment, instructions, origin) => {
  const key = name.trim().toLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  rows.push(
    `(${esc(name)}, '${primary}', ${pgArray(secondaries)}, ${esc(type)}, ${esc(equipment)}, ${esc(instructions)}, '${origin}')`
  );
  return true;
};

for (const list of Object.values(src.musculos)) {
  for (const ex of list) {
    const primary = toSlug(ex.musculo_principal);
    if (!primary) throw new Error(`Músculo desconocido: ${ex.musculo_principal} (${ex.nombre})`);
    const secondaries = [...new Set((ex.musculos_secundarios ?? []).map(toSlug).filter((s) => s && s !== primary))];
    let instructions = ex.instruccion || "";
    const variantes = Array.isArray(ex.variantes) ? ex.variantes.map((v) => v.trim()).filter(Boolean) : [];
    const sinonimos = nonEmpty(ex.sinonimos);
    if (sinonimos) instructions += `\nTambién conocido como: ${sinonimos}`;
    const type = join(ex.tipo);
    const equipment = join(ex.equipamiento);
    pushRow(ex.nombre, primary, secondaries, type, equipment, instructions, "curated");
    // Cada variante es un ejercicio agregable por sí mismo
    for (const v of variantes) {
      pushRow(
        v,
        primary,
        secondaries,
        type,
        equipment,
        `${ex.instruccion || ""}\nVariante de: ${ex.nombre}`,
        "curated-variant"
      );
    }
  }
}

const sql = `-- MIGRACIÓN: Reemplazar catálogo por ejercicios curados con músculo preciso.
-- Generado por scripts/build-exercise-seed.mjs desde ejercicios_gimnasio.json
-- (${rows.length} ejercicios). NO EDITAR A MANO: regenerar.
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
${rows.join(",\n")};

COMMIT;

-- VERIFICACIÓN: debe devolver ${rows.length}
-- SELECT count(*) FROM public.exercises WHERE origin LIKE 'curated%';
`;

writeFileSync(path.join(root, "sql", "migrations", "seed_exercises_curated.sql"), sql, "utf8");
console.log(`Seed generado: ${rows.length} ejercicios`);
