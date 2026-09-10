// Plantillas de rutina curadas. Los nombres deben coincidir EXACTO
// (ignorando mayúsculas) con el catálogo de `exercises` en DB.

export interface TemplateSerieSpec {
  sets: number;
  reps: number;
  note?: string;
}

export interface TemplateExerciseSpec {
  /** Nombre exacto del ejercicio en el catálogo */
  name: string;
  sets: number;
  /** null = sin prefijar, lo completa el usuario */
  reps: number | null;
  note?: string;
}

export interface RoutineTemplate {
  key: string;
  name: string;
  description: string;
  category: string;
  exercises: TemplateExerciseSpec[];
}

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    key: "push",
    name: "Pecho, Hombros y Tríceps",
    description: "Empuje completo: pecho, hombros y tríceps. 4 series por ejercicio, pesos y reps a tu medida.",
    category: "Push",
    exercises: [
      { name: "Press de banca", sets: 4, reps: null },
      { name: "Press militar con barra", sets: 4, reps: null },
      { name: "Fondos en paralelas", sets: 4, reps: null },
      { name: "Extension de triceps en polea alta", sets: 4, reps: null },
      { name: "Elevaciones laterales con mancuernas", sets: 4, reps: null },
    ],
  },
  {
    key: "legs",
    name: "Piernas Completa",
    description: "Cuádriceps, posteriores, glúteos y gemelos. 4 series por ejercicio, pesos y reps a tu medida.",
    category: "Piernas",
    exercises: [
      { name: "Sentadilla", sets: 4, reps: null },
      { name: "Prensa de piernas", sets: 4, reps: null },
      { name: "Zancadas (estocadas) con mancuernas", sets: 4, reps: null },
      { name: "Hip thrust (empuje de cadera)", sets: 4, reps: null },
      { name: "Elevacion de talon de pie", sets: 4, reps: null },
    ],
  },
  {
    key: "pull",
    name: "Espalda y Bíceps",
    description: "Tirón completo: espalda y bíceps. 4 series por ejercicio, pesos y reps a tu medida.",
    category: "Pull",
    exercises: [
      { name: "Peso muerto convencional", sets: 4, reps: null },
      { name: "Dominadas", sets: 4, reps: null },
      { name: "Remo con barra", sets: 4, reps: null },
      { name: "Jalon al pecho en polea alta", sets: 4, reps: null },
      { name: "Curl de biceps con mancuernas", sets: 4, reps: null },
    ],
  },
];

export interface CatalogEntry {
  id: string;
  name: string;
}

export interface MatchedTemplateExercise {
  exerciseId: string;
  name: string;
  orden: number;
  sets: number;
  reps: number | null;
  note: string | null;
}

/** Cruza la plantilla con el catálogo. Si falta algo, lo reporta en `missing`. */
export function matchTemplateExercises(
  template: RoutineTemplate,
  catalog: CatalogEntry[]
): { matched: MatchedTemplateExercise[]; missing: string[] } {
  const byName = new Map(catalog.map((c) => [c.name.trim().toLowerCase(), c]));
  const matched: MatchedTemplateExercise[] = [];
  const missing: string[] = [];

  template.exercises.forEach((spec, idx) => {
    const found = byName.get(spec.name.trim().toLowerCase());
    if (!found) {
      missing.push(spec.name);
      return;
    }
    matched.push({
      exerciseId: found.id,
      name: found.name,
      orden: idx + 1,
      sets: spec.sets,
      reps: spec.reps,
      note: spec.note ?? null,
    });
  });

  return { matched, missing };
}
