import type { EditableRoutine, EditableSerie, RoutinePayload } from "@/types/routine";

export const TEMP_ID_PREFIX = "temp-";

export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX);
}

export function tempId(): string {
  return `${TEMP_ID_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultSeries(count = 3, reps = "10", weight = "0"): EditableSerie[] {
  return Array.from({ length: count }, (_, index) => ({
    id: tempId(),
    type: "normal" as const,
    reps,
    weight,
    orden: index + 1,
    notes: null,
  }));
}

export function buildRoutinePayload(routine: EditableRoutine): RoutinePayload {
  return {
    nombre: routine.name.trim(),
    descripcion: routine.description.trim() || null,
    publica: routine.public,
    ejercicios: routine.exercises.map((exercise, exerciseIndex) => ({
      routine_exercise_id: exercise.routine_exercise_id,
      ejercicio_id: exercise.exercise_id,
      orden: exerciseIndex + 1,
      notas: exercise.notes?.trim() ? exercise.notes.trim() : null,
      series: exercise.series.map((serie, serieIndex) => ({
        serie_id: isTempId(serie.id) ? null : serie.id,
        type: serie.type,
        reps: serie.reps || "0",
        weight: serie.weight || "0",
        orden: serieIndex + 1,
        notes: serie.notes?.trim() ? serie.notes.trim() : null,
      })),
    })),
  };
}
