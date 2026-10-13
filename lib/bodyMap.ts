import type { Muscle } from "react-body-highlighter";
import type { MuscleSlug } from "./muscles";
import type { ProgressRangeKey } from "@/types/progress";

/** Slugs de react-body-highlighter por músculo de la app. */
export const MUSCLE_SLUES: Record<MuscleSlug, Muscle[]> = {
  pectoral: ["chest"],
  dorsal: ["upper-back", "lower-back"],
  trapecio: ["trapezius"],
  "deltoides-anterior": ["front-deltoids"],
  "deltoides-medio": ["front-deltoids", "back-deltoids"],
  "deltoides-posterior": ["back-deltoids"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  antebrazo: ["forearm"],
  abdominales: ["abs"],
  oblicuos: ["obliques"],
  lumbares: ["lower-back"],
  cuadriceps: ["quadriceps"],
  isquiotibiales: ["hamstring"],
  gluteos: ["gluteal"],
  gemelos: ["calves"],
};

const SLUG_TO_MUSCLE: Record<string, MuscleSlug> = {};
for (const [muscle, slugs] of Object.entries(MUSCLE_SLUES) as [MuscleSlug, Muscle[]][]) {
  for (const slug of slugs) {
    // Gana el primero (orden del literal): p. ej. "front-deltoids" → deltoides-anterior.
    SLUG_TO_MUSCLE[slug] ??= muscle;
  }
}

// Al tocar el modelo, estas zonas ambiguas resuelven al músculo más específico.
SLUG_TO_MUSCLE["back-deltoids"] = "deltoides-posterior";
SLUG_TO_MUSCLE["lower-back"] = "lumbares";

export function muscleOfSlug(slug: string): MuscleSlug | null {
  return SLUG_TO_MUSCLE[slug] ?? null;
}

/** Escala de azules de la app (claro → intenso) para 5 niveles. */
export const BODY_BLUE_SCALE = ["#dbeafe", "#93c5f4", "#60a5fa", "#2563eb", "#1e40af"];

/** Intensidad 0..1 → nivel 0 (sin trabajar) o 1..5. */
export function intensityLevel(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  if (ratio >= 1) return 5;
  return Math.min(5, Math.floor(ratio * 5) + 1);
}

/** Texto del período para el detalle ("en los últimos 30 días", ...). */
export function rangeDescription(range: ProgressRangeKey): string {
  switch (range) {
    case "week":
      return "esta semana";
    case "30d":
      return "los últimos 30 días";
    case "90d":
      return "los últimos 90 días";
    case "all":
      return "todo el historial";
  }
}
