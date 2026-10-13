// Taxonomía canónica de músculos de Habitus: 16 músculos precisos.
//
// Cada ejercicio tiene UN músculo principal (`exercises.primary_muscle_id`,
// FK a `muscles.id`) y secundarios opcionales (`secondary_muscle_ids`).
// El `slug` es el id estable en DB, código y URLs. No renombrar.

export const MUSCLE_SLUGS = [
  "pectoral",
  "dorsal",
  "trapecio",
  "deltoides-anterior",
  "deltoides-medio",
  "deltoides-posterior",
  "biceps",
  "triceps",
  "antebrazo",
  "abdominales",
  "oblicuos",
  "lumbares",
  "cuadriceps",
  "isquiotibiales",
  "gluteos",
  "gemelos",
] as const;

export type MuscleSlug = (typeof MUSCLE_SLUGS)[number];

export type MuscleRegion =
  | "Pecho"
  | "Espalda"
  | "Hombros"
  | "Brazos"
  | "Core"
  | "Piernas";

export interface MuscleDef {
  slug: MuscleSlug;
  name: string;
  region: MuscleRegion;
  color: string;
}

export const MUSCLES: MuscleDef[] = [
  { slug: "pectoral", name: "Pectoral", region: "Pecho", color: "#3b82f6" },
  { slug: "dorsal", name: "Dorsal ancho", region: "Espalda", color: "#10b981" },
  { slug: "trapecio", name: "Trapecio", region: "Espalda", color: "#14b8a6" },
  { slug: "deltoides-anterior", name: "Deltoides anterior", region: "Hombros", color: "#8b5cf6" },
  { slug: "deltoides-medio", name: "Deltoides medio", region: "Hombros", color: "#c084fc" },
  { slug: "deltoides-posterior", name: "Deltoides posterior", region: "Hombros", color: "#6d28d9" },
  { slug: "biceps", name: "Bíceps", region: "Brazos", color: "#ec4899" },
  { slug: "triceps", name: "Tríceps", region: "Brazos", color: "#f43f5e" },
  { slug: "antebrazo", name: "Antebrazo", region: "Brazos", color: "#f472b6" },
  { slug: "abdominales", name: "Abdominales", region: "Core", color: "#06b6d4" },
  { slug: "oblicuos", name: "Oblicuos", region: "Core", color: "#0ea5e9" },
  { slug: "lumbares", name: "Lumbares", region: "Core", color: "#d946ef" },
  { slug: "cuadriceps", name: "Cuádriceps", region: "Piernas", color: "#f59e0b" },
  { slug: "isquiotibiales", name: "Isquiotibiales", region: "Piernas", color: "#f97316" },
  { slug: "gluteos", name: "Glúteos", region: "Piernas", color: "#ef4444" },
  { slug: "gemelos", name: "Gemelos", region: "Piernas", color: "#84cc16" },
];

export const MUSCLE_BY_SLUG: Record<MuscleSlug, MuscleDef> = Object.fromEntries(
  MUSCLES.map((m) => [m.slug, m])
) as Record<MuscleSlug, MuscleDef>;

export function isMuscleSlug(value: string | null | undefined): value is MuscleSlug {
  return !!value && (MUSCLE_SLUGS as readonly string[]).includes(value);
}

/** Nombre para mostrar ("biceps" → "Bíceps"). Desconocido → el crudo o "—". */
export function muscleName(slug: string | null | undefined): string {
  if (!slug) return "—";
  return MUSCLE_BY_SLUG[slug as MuscleSlug]?.name ?? slug;
}

/** Color del músculo para gráficos. Desconocido → gris. */
export function muscleColor(slug: string | null | undefined): string {
  if (!slug) return "#94a3b8";
  return MUSCLE_BY_SLUG[slug as MuscleSlug]?.color ?? "#94a3b8";
}

function normKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

// Texto libre (API Ninjas en inglés, español preciso del JSON curado o
// zonas legacy) → slug canónico. Uso: seed/import. En la app el músculo
// ya viene como FK, no hace falta normalizar.
const RAW_TO_MUSCLE: Record<string, MuscleSlug> = {
  // slugs directos
  pectoral: "pectoral",
  dorsal: "dorsal",
  trapecio: "trapecio",
  deltoides_anterior: "deltoides-anterior",
  deltoides_medio: "deltoides-medio",
  deltoides_lateral: "deltoides-medio",
  deltoides_posterior: "deltoides-posterior",
  biceps: "biceps",
  triceps: "triceps",
  antebrazo: "antebrazo",
  abdominales: "abdominales",
  oblicuos: "oblicuos",
  lumbares: "lumbares",
  cuadriceps: "cuadriceps",
  isquiotibiales: "isquiotibiales",
  gluteos: "gluteos",
  gemelos: "gemelos",
  // API Ninjas (inglés)
  chest: "pectoral",
  lats: "dorsal",
  middle_back: "trapecio",
  lower_back: "lumbares",
  traps: "trapecio",
  neck: "trapecio",
  shoulders: "deltoides-medio",
  abdominals: "abdominales",
  abs: "abdominales",
  quadriceps: "cuadriceps",
  hamstrings: "isquiotibiales",
  calves: "gemelos",
  glutes: "gluteos",
  abductors: "gluteos",
  adductors: "cuadriceps",
  forearms: "antebrazo",
  forearm: "antebrazo",
  // español preciso (JSON curado / anatomía)
  pectoral_mayor: "pectoral",
  pectorales: "pectoral",
  dorsal_ancho: "dorsal",
  dorsales: "dorsal",
  redondo_mayor: "dorsal",
  deltoides: "deltoides-medio",
  deltoide: "deltoides-medio",
  biceps_braquial: "biceps",
  triceps_braquial: "triceps",
  braquiorradial: "antebrazo",
  antebrazos: "antebrazo",
  recto_abdominal: "abdominales",
  abdominal: "abdominales",
  oblicuo: "oblicuos",
  erectores_espinales: "lumbares",
  lumbar: "lumbares",
  espalda_baja: "lumbares",
  isquios: "isquiotibiales",
  cuadricep: "cuadriceps",
  gluteo: "gluteos",
  gluteo_mayor: "gluteos",
  gemelo: "gemelos",
  soleo: "gemelos",
  pantorrilla: "gemelos",
  pantorrillas: "gemelos",
  // zonas legacy (mapeo con pérdida, solo compatibilidad)
  pecho: "pectoral",
  espalda: "dorsal",
  piernas: "cuadriceps",
  pierna: "cuadriceps",
  hombros: "deltoides-medio",
  hombro: "deltoides-medio",
  brazos: "biceps",
  brazo: "biceps",
  core: "abdominales",
};

export function normalizeMuscle(raw: string | null | undefined): MuscleSlug | null {
  if (!raw) return null;
  const key = normKey(raw);
  return (
    RAW_TO_MUSCLE[key] ??
    RAW_TO_MUSCLE[key.replace(/_/g, "")] ??
    null
  );
}
