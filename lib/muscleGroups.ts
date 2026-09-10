// Normalización de `exercises.muscle` (texto libre, EN/ES) a 7 zonas amigables.
// Fuente de valores crudos: API Ninjas (abdominals, chest, biceps...) + manuales en español.

export const MUSCLE_GROUPS = [
  "Pecho",
  "Espalda",
  "Piernas",
  "Hombros",
  "Brazos",
  "Core",
  "Glúteos",
  "Gemelos",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

const RAW_TO_GROUP: Record<string, MuscleGroup> = {
  chest: "Pecho",
  pecho: "Pecho",
  pectoral: "Pecho",
  lats: "Espalda",
  middle_back: "Espalda",
  lower_back: "Espalda",
  espalda: "Espalda",
  back: "Espalda",
  dorsal: "Espalda",
  quadriceps: "Piernas",
  hamstrings: "Piernas",
  calves: "Gemelos",
  abductors: "Piernas",
  adductors: "Piernas",
  pierna: "Piernas",
  piernas: "Piernas",
  cuadriceps: "Piernas",
  isquios: "Piernas",
  shoulders: "Hombros",
  traps: "Hombros",
  neck: "Hombros",
  hombro: "Hombros",
  hombros: "Hombros",
  trapecio: "Hombros",
  biceps: "Brazos",
  triceps: "Brazos",
  forearms: "Brazos",
  brazo: "Brazos",
  brazos: "Brazos",
  biceps_: "Brazos",
  abdominals: "Core",
  core: "Core",
  abs: "Core",
  abdominales: "Core",
  glutes: "Glúteos",
  gluteos: "Glúteos",
  "glúteos": "Glúteos",
  gluteo: "Glúteos",
  "gluteo mayor": "Glúteos",
  gemelos: "Gemelos",
  gemelo: "Gemelos",
  soleo: "Gemelos",
  pantorrilla: "Gemelos",
  pantorrillas: "Gemelos",
  pectorales: "Pecho",
  dorsales: "Espalda",
  deltoides: "Hombros",
  deltoide: "Hombros",
  isquiotibiales: "Piernas",
  abdominal: "Core",
  "recto abdominal": "Core",
  oblicuos: "Core",
  oblicuo: "Core",
};

export function normalizeMuscleGroup(raw: string | null | undefined): MuscleGroup | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // quitar espacios/guiones para matchear lower_back, lower back, etc.
  const compact = key.replace(/[\s-]+/g, "_");
  // intento directo + sin guiones bajos
  return (
    RAW_TO_GROUP[compact] ??
    RAW_TO_GROUP[compact.replace(/_/g, "")] ??
    RAW_TO_GROUP[key] ??
    null
  );
}

export const MUSCLE_GROUP_COLORS: Record<MuscleGroup, string> = {
  Pecho: "#3b82f6",
  Espalda: "#10b981",
  Piernas: "#f59e0b",
  Hombros: "#8b5cf6",
  Brazos: "#ec4899",
  Core: "#06b6d4",
  "Glúteos": "#f97316",
  Gemelos: "#84cc16",
};
