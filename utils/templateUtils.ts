import { createClient } from "./supabase/client";
import { getExercises } from "./exercisesUtils";
import { createRoutineBasic, createSerie, getRoutineExercises } from "./routineUtils";
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
  const catalog = (await getExercises()) as { id: string; name: string }[];
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
  const newRes = await getRoutineExercises(routineId);
  for (const m of matched) {
    const target = newRes.find((nr) => nr.orden === m.orden && nr.exercise_id === m.exerciseId);
    if (!target) continue;
    for (let i = 0; i < m.sets; i++) {
      await createSerie(target.id, {
        type: "normal",
        reps: m.reps != null ? String(m.reps) : "",
        weight: "",
        orden: i + 1,
        notes: m.note,
      });
    }
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
