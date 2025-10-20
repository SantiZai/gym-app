import { createClient } from "./supabase/client";
import type { Session, SessionSerie } from "@/types/db";

export const startSession = async (routineId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_session', { p_routine_id: routineId });
  if (error) throw error;
  // data es uuid retornado (puede variar según supabase rpc wrapper)
  // if supabase returns array: const sesionId = data[0];
  const sesionId = data as unknown as string;
  // redirigir a la ruta de sesión
  window.location.href = `/sesion/${sesionId}`;
}

// Obtener sesión con todos sus datos
export async function getSessionById(sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return data as Session;
}

// Obtener la rutina de una sesión con ejercicios y series
// Note: Supabase returns 'exercise' as an array even for single relationships
// The client should transform it to a single object: re.exercise[0]
export async function getSessionData(sessionId: string) {
  const supabase = await createClient();

  // Obtener la sesión
  const session = await getSessionById(sessionId);

  // Obtener los ejercicios de la rutina con sus series planificadas
  const { data: routineExercises, error: exercisesError } = await supabase
    .from("routine_exercises")
    .select(`
      id,
      orden,
      notes,
      exercise:exercises (
        id,
        name,
        muscle,
        type,
        equipment,
        instructions
      ),
      series (
        id,
        type,
        reps,
        weight,
        orden,
        notes
      )
    `)
    .eq("routine_id", session.routine_id)
    .order("orden", { ascending: true });

  if (exercisesError) throw exercisesError;

  // Obtener las session_series ya completadas
  const { data: sessionSeries, error: sessionSeriesError } = await supabase
    .from("session_series")
    .select("*")
    .eq("session_id", sessionId);

  if (sessionSeriesError) throw sessionSeriesError;

  return {
    session,
    routineExercises,
    sessionSeries: sessionSeries as SessionSerie[],
  };
}

// Actualizar o crear session_serie
export async function updateOrCreateSessionSerie(
  sessionId: string,
  serieId: string | null,
  exerciseId: string,
  data: {
    weight_used?: number | null;
    reps_performed?: number | null;
    completed?: boolean;
    started_at?: string | null;
    completed_at?: string | null;
  }
) {
  const supabase = await createClient();

  // Verificar si ya existe
  const { data: existing, error: findError } = await supabase
    .from("session_series")
    .select("*")
    .eq("session_id", sessionId)
    .eq("serie_id", serieId)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    // Actualizar
    const { data: updated, error: updateError } = await supabase
      .from("session_series")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated as SessionSerie;
  } else {
    // Crear
    const { data: created, error: createError } = await supabase
      .from("session_series")
      .insert({
        session_id: sessionId,
        serie_id: serieId,
        exercise_id: exerciseId,
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) throw createError;
    return created as SessionSerie;
  }
}

// Marcar serie como completada
export async function completeSessionSerie(
  sessionId: string,
  serieId: string,
  exerciseId: string,
  weightUsed: number | null,
  repsPerformed: number | null,
  completed: boolean,
) {
  const now = new Date().toISOString();
  return updateOrCreateSessionSerie(sessionId, serieId, exerciseId, {
    weight_used: weightUsed,
    reps_performed: repsPerformed,
    completed: completed,
    completed_at: completed ? now : null,
  });
}

// Iniciar serie (marcar cuando se empieza)
export async function startSessionSerie(
  sessionId: string,
  serieId: string,
  exerciseId: string
) {
  const now = new Date().toISOString();
  return updateOrCreateSessionSerie(sessionId, serieId, exerciseId, {
    started_at: now,
  });
}

// Finalizar sesión y actualizar rutina si hay cambios
export async function finishSession(sessionId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Obtener la sesión
  const session = await getSessionById(sessionId);

  // Calcular duración
  const startedAt = new Date(session.started_at);
  const endedAt = new Date(now);
  const durationMs = endedAt.getTime() - startedAt.getTime();
  const durationMinutes = Math.floor(durationMs / 60000);

  // Actualizar sesión
  const { error: sessionError } = await supabase
    .from("sessions")
    .update({
      status: "finished",
      ended_at: now,
      duration: `${durationMinutes} minutes`,
    })
    .eq("id", sessionId);

  if (sessionError) throw sessionError;

  // Analizar cambios y actualizar rutina
  await analyzeAndUpdateRoutine(sessionId, session.routine_id);

  return { success: true };
}

// Analizar sesión y actualizar series de la rutina basado en progreso
async function analyzeAndUpdateRoutine(sessionId: string, routineId: string) {
  const supabase = await createClient();

  // Obtener session_series completadas
  const { data: sessionSeries, error: sessionSeriesError } = await supabase
    .from("session_series")
    .select("*")
    .eq("session_id", sessionId)
    .eq("completed", true);

  if (sessionSeriesError) throw sessionSeriesError;
  if (!sessionSeries || sessionSeries.length === 0) return;

  // Agrupar por serie_id
  const seriesMap = new Map<string, SessionSerie[]>();
  sessionSeries.forEach((ss) => {
    if (ss.serie_id) {
      if (!seriesMap.has(ss.serie_id)) {
        seriesMap.set(ss.serie_id, []);
      }
      seriesMap.get(ss.serie_id)!.push(ss as SessionSerie);
    }
  });

  // Para cada serie original, verificar si hay mejoras consistentes
  for (const [serieId, completedSeries] of seriesMap.entries()) {
    // Si solo hay una sesión registrada, usar esos datos
    if (completedSeries.length === 1) {
      const ss = completedSeries[0];

      // Obtener la serie original
      const { data: originalSerie, error: serieError } = await supabase
        .from("series")
        .select("*")
        .eq("id", serieId)
        .single();

      if (serieError || !originalSerie) continue;

      // Actualizar si hay cambios significativos
      const updates: any = {};
      let hasChanges = false;

      // Actualizar peso si cambió
      if (ss.weight_used !== null && ss.weight_used !== originalSerie.weight) {
        updates.weight = ss.weight_used;
        hasChanges = true;
      }

      // Actualizar reps si cambió
      if (ss.reps_performed !== null && ss.reps_performed !== originalSerie.reps) {
        updates.reps = ss.reps_performed;
        hasChanges = true;
      }

      if (hasChanges) {
        await supabase
          .from("series")
          .update(updates)
          .eq("id", serieId);
      }
    }
  }
}

// Cancelar sesión
export async function cancelSession(sessionId: string) {
  const supabase = await createClient();

  // Eliminar session_series
  await supabase
    .from("session_series")
    .delete()
    .eq("session_id", sessionId);

  // Eliminar sesión
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId);

  if (error) throw error;
}

export async function getLastPerformedByExerciseIds(exerciseIds: string[]) {
  const supabase = await createClient();

  if (!exerciseIds || exerciseIds.length === 0) return [];

  // supabase.rpc espera array tipo uuid[]
  const { data, error } = await supabase
    .rpc("get_last_performed_by_exercises_by_last_planned_series", { p_exercise_ids: exerciseIds });

  if (error) {
    console.error("getLastPerformedByExerciseIds error:", error);
    return [];
  }

  return data || [];
}
