import { createClient } from "./supabase/client";
import type { Session, SessionSerie } from "@/types/db";
import type { SessionSummary } from "@/types/progress";

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

export async function getUserSessions(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) throw error;
  return data as Session[];
}

export async function getSessionSeriesBySessionId(sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_series")
    .select("*")
    .eq("session_id", sessionId);

    if (error) throw error;
    return data as SessionSerie[];
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

// Finalizar sesión vía RPC (cierra la sesión y devuelve el resumen agregado)
// y actualizar rutina si hay cambios. Ver sql/functions.sql → finish_session.
export async function finishSession(sessionId: string): Promise<SessionSummary> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("finish_session", { p_session_id: sessionId });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as {
    session_id: string;
    started_at: string | null;
    ended_at: string | null;
    duration: string | null;
    total_series_completed: number | string | null;
    total_volume: number | string | null;
  } | null | undefined;

  if (!row) throw new Error("No se pudo finalizar la sesión");

  // Analizar cambios y actualizar rutina
  await analyzeAndUpdateRoutine(sessionId);

  return {
    sessionId: row.session_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationLabel: formatSessionDuration(row.duration, row.started_at, row.ended_at),
    totalSeriesCompleted: Number(row.total_series_completed ?? 0),
    totalVolume: Number(row.total_volume ?? 0),
  };
}

export function formatSessionDuration(
  raw: string | null | undefined,
  startedAt: string | null | undefined,
  endedAt: string | null | undefined
): string {
  const toLabel = (totalMinutes: number) => {
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "—";
    const m = Math.floor(totalMinutes);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
  };

  // Postgres serializa interval como "[N days ]HH:MM:SS"
  if (raw) {
    const match = raw.match(/(?:(\d+)\s+days?\s+)?(\d+):(\d+)(?::(\d+))?/);
    if (match) {
      const days = parseInt(match[1] ?? "0", 10);
      const hours = parseInt(match[2], 10);
      const minutes = parseInt(match[3], 10);
      return toLabel(days * 24 * 60 + hours * 60 + minutes);
    }
  }

  if (startedAt && endedAt) {
    // La DB guarda ended_at naive en UTC: sin designador se asume Z
    const asUtc = (iso: string) => (/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
    const ms = new Date(asUtc(endedAt)).getTime() - new Date(asUtc(startedAt)).getTime();
    if (Number.isFinite(ms)) return toLabel(ms / 60000);
  }
  return "—";
}

// Analizar sesión y actualizar series de la rutina basado en progreso
async function analyzeAndUpdateRoutine(sessionId: string) {
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
      const updates: { weight?: number | null; reps?: number | null } = {};
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
