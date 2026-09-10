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
  reps: number;
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
    key: "full-body",
    name: "Full Body",
    description: "Cuerpo completo en una sesión, 3 veces por semana.",
    category: "Full Body",
    exercises: [
      { name: "Sentadilla", sets: 3, reps: 8 },
      { name: "Press de banca", sets: 3, reps: 8 },
      { name: "Remo con barra", sets: 3, reps: 8 },
      { name: "Peso muerto rumano", sets: 3, reps: 8 },
      { name: "Plancha", sets: 3, reps: 45, note: "Mantener segundos" },
    ],
  },
  {
    key: "push",
    name: "Push — Empuje",
    description: "Pecho, hombros y tríceps.",
    category: "Push-Pull-Legs",
    exercises: [
      { name: "Press de banca", sets: 3, reps: 8 },
      { name: "Press militar con barra", sets: 3, reps: 8 },
      { name: "Elevaciones laterales con mancuernas", sets: 3, reps: 12 },
      { name: "Fondos en paralelas", sets: 3, reps: 10 },
      { name: "Extension de triceps en polea alta", sets: 3, reps: 12 },
    ],
  },
  {
    key: "pull",
    name: "Pull — Tirón",
    description: "Espalda y bíceps.",
    category: "Push-Pull-Legs",
    exercises: [
      { name: "Peso muerto convencional", sets: 3, reps: 5 },
      { name: "Dominadas", sets: 3, reps: 8, note: "Usar asistencia si hace falta" },
      { name: "Remo con barra", sets: 3, reps: 8 },
      { name: "Jalon al pecho en polea alta", sets: 3, reps: 10 },
      { name: "Curl de biceps con mancuernas", sets: 3, reps: 12 },
    ],
  },
  {
    key: "legs",
    name: "Legs — Piernas",
    description: "Cuádriceps, posteriores, glúteos y gemelos.",
    category: "Push-Pull-Legs",
    exercises: [
      { name: "Sentadilla", sets: 3, reps: 8 },
      { name: "Prensa de piernas", sets: 3, reps: 10 },
      { name: "Zancadas (estocadas) con mancuernas", sets: 3, reps: 10 },
      { name: "Hip thrust (empuje de cadera)", sets: 3, reps: 12 },
      { name: "Elevacion de talon de pie", sets: 3, reps: 15 },
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
  reps: number;
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
