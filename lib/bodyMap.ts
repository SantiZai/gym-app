import type { Muscle } from "react-body-highlighter";
import type { MuscleGroup } from "./muscleGroups";
import type { ProgressRangeKey } from "@/types/progress";

/** Slugs de react-body-highlighter por zona muscular de la app. */
export const GROUP_SLUES: Record<MuscleGroup, Muscle[]> = {
  Pecho: ["chest"],
  Espalda: ["trapezius", "upper-back", "lower-back"],
  Piernas: ["quadriceps", "hamstring", "adductor", "abductors"],
  Hombros: ["front-deltoids", "back-deltoids"],
  Brazos: ["biceps", "triceps", "forearm"],
  Core: ["abs", "obliques"],
  "Glúteos": ["gluteal"],
  Gemelos: ["calves"],
};

const SLUG_TO_GROUP: Record<string, MuscleGroup> = Object.fromEntries(
  Object.entries(GROUP_SLUES).flatMap(([group, slugs]) =>
    slugs.map((slug) => [slug, group as MuscleGroup])
  )
);

export function groupOfSlug(slug: string): MuscleGroup | null {
  return SLUG_TO_GROUP[slug] ?? null;
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
