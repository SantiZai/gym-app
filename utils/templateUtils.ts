import { createClient } from "./supabase/client";
import { getExercisesCached } from "./exercisesUtils";
import { createRoutineBasic, getRoutineExercises } from "./routineUtils";
import { matchTemplateExercises, type RoutineTemplate } from "@/lib/routineTemplates";

export class MissingExercisesError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super(`Faltan ejercicios en el catálogo: ${missing.join(", ")}`);
    this.missing = missing;
  }
}

// Crea una rutina privada desde una plantilla, con ejercicios y series.
// Devuelve el id de la rutina creada.
export async function createRoutineFromTemplate(template: RoutineTemplate): Promise<string> {
  const catalog = (await getExercisesCached()) as { id: string; name: string }[];
  const { matched, missing } = matchTemplateExercises(template, catalog ?? []);
  if (missing.length > 0) throw new MissingExercisesError(missing);

  const routineId = await createRoutineBasic({
    nombre: template.name,
    descripcion: template.description,
    publica: false,
    ejercicios: matched.map((m) => ({
      ejercicio_id: m.exerciseId,
      orden: m.orden,
      notas: m.note,
    })),
  });

  // Agregar series según la plantilla (sin pesos ni reps: los completa el usuario)
  const newRes = (await getRoutineExercises(routineId)) as {
    id: string;
    orden: number;
    exercise_id: string;
  }[];
  const byKey = new Map(newRes.map((row) => [`${row.exercise_id}|${row.orden}`, row.id]));

  const serieRows = matched.flatMap((m) => {
    const routineExerciseId = byKey.get(`${m.exerciseId}|${m.orden}`);
    if (!routineExerciseId) return [];
    return Array.from({ length: m.sets }, (_, index) => ({
      routine_exercise_id: routineExerciseId,
      type: "normal",
      reps: m.reps ?? 0,
      weight: null,
      orden: index + 1,
      notes: m.note,
    }));
  });

  if (serieRows.length > 0) {
    const supabase = await createClient();
    const { error } = await supabase.from("series").insert(serieRows);
    if (error) throw error;
  }

  // Guardar categoría (best-effort, no bloquea si falla)
  try {
    const supabase = await createClient();
    await supabase.from("routines").update({ category: template.category }).eq("id", routineId);
  } catch (error) {
    console.error("No se pudo guardar la categoría:", error);
  }

  return routineId;
}
