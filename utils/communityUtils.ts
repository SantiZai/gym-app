import { createClient } from "./supabase/client";
import type { Exercise, Routine, Serie } from "@/types/db";
import {
  createRoutineBasic,
  getRoutineById,
  getRoutineExercises,
  getSeriesByRoutineExerciseId,
  createSerie,
} from "./routineUtils";
import { getExercisesByIds } from "./exercisesUtils";

export interface PublicRoutine {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  authorName: string;
  authorAvatar: string | null;
  exercisesCount: number;
  createdAt: string;
}

export interface PublicRoutineExercise {
  exercise: Exercise;
  orden: number;
  notes: string | null;
  series: Serie[];
}

export interface PublicRoutineDetail {
  routine: Routine;
  authorName: string;
  authorAvatar: string | null;
  exercises: PublicRoutineExercise[];
}

async function getAuthorMap(userIds: string[]): Promise<Map<string, { name: string; avatar: string | null }>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id,name,avatar_url")
    .in("id", unique);
  if (error) throw error;
  return new Map(
    ((data ?? []) as { id: string; name: string | null; avatar_url: string | null }[]).map((p) => [
      String(p.id),
      { name: p.name || "Usuario", avatar: p.avatar_url },
    ])
  );
}

export async function getPublicRoutines(myUserId?: string): Promise<PublicRoutine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routines")
    .select("id,user_id,name,description,category,created_at")
    .eq("public", true)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const rows = ((data ?? []) as Routine[]).filter((r) => r.user_id !== myUserId);
  if (rows.length === 0) return [];

  const [authors, counts] = await Promise.all([
    getAuthorMap(rows.map((r) => r.user_id)),
    supabase
      .from("routine_exercises")
      .select("routine_id")
      .in("routine_id", rows.map((r) => r.id)),
  ]);
  if (counts.error) throw counts.error;

  const countByRoutine = new Map<string, number>();
  for (const row of (counts.data ?? []) as { routine_id: string }[]) {
    countByRoutine.set(row.routine_id, (countByRoutine.get(row.routine_id) ?? 0) + 1);
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category ?? null,
    authorName: authors.get(r.user_id)?.name ?? "Usuario",
    authorAvatar: authors.get(r.user_id)?.avatar ?? null,
    exercisesCount: countByRoutine.get(r.id) ?? 0,
    createdAt: r.created_at,
  }));
}

export async function getPublicRoutineDetail(routineId: string): Promise<PublicRoutineDetail> {
  const routine = (await getRoutineById(routineId)) as Routine;
  if (!routine || !routine.public) throw new Error("Rutina no disponible");

  const [routineExercises, authors] = await Promise.all([
    getRoutineExercises(routineId),
    getAuthorMap([routine.user_id]),
  ]);

  const exercisesFromApi = routineExercises.length > 0
    ? ((await getExercisesByIds(routineExercises.map((re) => re.exercise_id))) as Exercise[])
    : [];

  const exercises: PublicRoutineExercise[] = await Promise.all(
    routineExercises.map(async (re) => {
      const ex = exercisesFromApi.find((e) => e.id === re.exercise_id);
      const seriesData = await getSeriesByRoutineExerciseId(re.id);
      const series: Serie[] = seriesData.map(
        (s: { id: string; routine_exercise_id: string; type: string; reps: number | string; weight: number | string | null; orden: number; notes: string | null }) => ({
          id: s.id,
          routine_exercise_id: s.routine_exercise_id,
          type: s.type as Serie["type"],
          reps: String(s.reps),
          weight: s.weight != null ? String(s.weight) : "0",
          orden: s.orden,
          notes: s.notes,
        })
      );
      return {
        exercise: ex ?? { id: re.exercise_id, name: "Ejercicio", muscle: null, type: null, equipment: null, instructions: null, origin: null, created_at: "" },
        orden: re.orden,
        notes: re.notes,
        series,
      };
    })
  );

  exercises.sort((a, b) => a.orden - b.orden);

  return {
    routine,
    authorName: authors.get(routine.user_id)?.name ?? "Usuario",
    authorAvatar: authors.get(routine.user_id)?.avatar ?? null,
    exercises,
  };
}

// Copiar una rutina pública a mis rutinas (privada) con ejercicios y series
export async function forkRoutine(routineId: string): Promise<string> {
  const detail = await getPublicRoutineDetail(routineId);

  const newId = await createRoutineBasic({
    nombre: detail.routine.name,
    descripcion: detail.routine.description,
    publica: false,
    ejercicios: detail.exercises.map((e) => ({
      ejercicio_id: e.exercise.id,
      orden: e.orden,
      notas: e.notes,
    })),
  });

  // Mapear nuevos routine_exercises por orden para copiar las series
  const newRes = await getRoutineExercises(newId);
  for (const orig of detail.exercises) {
    const target = newRes.find(
      (nr) => nr.orden === orig.orden && nr.exercise_id === orig.exercise.id
    );
    if (!target) continue;
    for (const [idx, serie] of orig.series.entries()) {
      await createSerie(target.id, {
        type: serie.type,
        reps: serie.reps,
        weight: serie.weight,
        orden: idx + 1,
        notes: serie.notes,
      });
    }
  }

  return newId;
}
