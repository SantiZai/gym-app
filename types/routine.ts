import type { SerieType } from "./db";

export interface EditableSerie {
  id: string;
  type: SerieType;
  reps: string;
  weight: string;
  orden: number;
  notes: string | null;
}

export interface EditableExercise {
  exercise_id: string;
  name: string;
  primary_muscle_id: string | null;
  secondary_muscle_ids: string[];
  type: string | null;
  equipment: string | null;
  instructions: string | null;
  routine_exercise_id: string | null;
  orden: number;
  notes: string | null;
  series: EditableSerie[];
}

export interface EditableRoutine {
  id: string | null;
  name: string;
  description: string;
  public: boolean;
  exercises: EditableExercise[];
}

export interface RoutinePayloadSerie {
  serie_id: string | null;
  type: SerieType;
  reps: string;
  weight: string;
  orden: number;
  notes: string | null;
}

export interface RoutinePayloadExercise {
  routine_exercise_id: string | null;
  ejercicio_id: string;
  orden: number;
  notas: string | null;
  series: RoutinePayloadSerie[];
}

export interface RoutinePayload {
  nombre: string;
  descripcion: string | null;
  publica: boolean;
  ejercicios: RoutinePayloadExercise[];
}
