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
      { name: "Barbell Full Squat", sets: 3, reps: 8 },
      { name: "Barbell Bench Press - Medium Grip", sets: 3, reps: 8 },
      { name: "Seated Cable Rows", sets: 3, reps: 10 },
      { name: "Romanian Deadlift With Dumbbells", sets: 3, reps: 10 },
      { name: "Elbow plank", sets: 3, reps: 45, note: "Mantener segundos" },
    ],
  },
  {
    key: "push",
    name: "Push — Empuje",
    description: "Pecho, hombros y tríceps.",
    category: "Push-Pull-Legs",
    exercises: [
      { name: "Dumbbell Bench Press", sets: 3, reps: 10 },
      { name: "Incline dumbbell bench press", sets: 3, reps: 10 },
      { name: "Standing dumbbell upright row", sets: 3, reps: 12 },
      { name: "Cable V-bar push-down", sets: 3, reps: 12 },
      { name: "Triceps dip", sets: 3, reps: 10 },
    ],
  },
  {
    key: "pull",
    name: "Pull — Tirón",
    description: "Espalda y bíceps.",
    category: "Push-Pull-Legs",
    exercises: [
      { name: "Barbell Deadlift", sets: 3, reps: 5 },
      { name: "Pull-up", sets: 3, reps: 8, note: "Usar asistencia si hace falta" },
      { name: "Seated Cable Rows", sets: 3, reps: 10 },
      { name: "Barbell Curl", sets: 3, reps: 12 },
      { name: "Hammer Curls", sets: 3, reps: 12 },
    ],
  },
  {
    key: "legs",
    name: "Legs — Piernas",
    description: "Cuádriceps, posteriores, glúteos y gemelos.",
    category: "Push-Pull-Legs",
    exercises: [
      { name: "Barbell Full Squat", sets: 3, reps: 8 },
      { name: "Romanian Deadlift from Deficit", sets: 3, reps: 8 },
      { name: "Single-Leg Press", sets: 3, reps: 10 },
      { name: "Barbell Hip Thrust", sets: 3, reps: 12 },
      { name: "Standing Calf Raises", sets: 3, reps: 15 },
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
