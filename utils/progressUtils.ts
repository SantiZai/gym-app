import { createClient } from "@/utils/supabase/client";
import { normalizeMuscleGroup } from "@/lib/muscleGroups";
import { calcWeeklyStreak, dayKeyFromISO, getMonday } from "@/lib/streak";
import type {
  DaySessionDetail,
  ExerciseHistoryPoint,
  MuscleSlice,
  PersonalRecord,
  ProgressRangeKey,
  StreakInfo,
  TrainedExercise,
  TrainingDay,
  VolumePoint,
} from "@/types/progress";

// ---------- helpers ----------

export function estimate1RM(weight: number | null, reps: number | null): number | null {
  if (weight == null || reps == null || !Number.isFinite(weight) || !Number.isFinite(reps)) return null;
  if (weight <= 0 || reps <= 0) return null;
  if (reps === 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10; // Epley
}

export function rangeToSince(range: ProgressRangeKey): Date | null {
  if (range === "all") return null;
  if (range === "week") return getMonday(new Date()); // lunes 00:00 de esta semana
  const days = range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SessionRow = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SeriesRow = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExerciseRow = Record<string, any>;

function sessionDateISO(s: SessionRow): string | null {
  return s.date ?? s.created_at ?? s.started_at ?? null;
}

export function sessionDayKey(s: SessionRow): string | null {
  return dayKeyFromISO(sessionDateISO(s));
}

// Dedup de peticiones concurrentes idénticas (un mount dispara varios
// hooks en paralelo). Solo comparte vuelos en curso: al terminar se olvida,
// así que navegaciones posteriores traen datos frescos.
const sessionsInflight = new Map<string, Promise<SessionRow[]>>();
const seriesInflight = new Map<string, Promise<SeriesRow[]>>();

async function getSessions(userId: string, since: Date | null): Promise<SessionRow[]> {
  const key = `${userId}|${since ? since.getTime() : "all"}`;
  const existing = sessionsInflight.get(key);
  if (existing) return existing;
  const pending = fetchSessions(userId, since).finally(() => {
    if (sessionsInflight.get(key) === pending) sessionsInflight.delete(key);
  });
  sessionsInflight.set(key, pending);
  return pending;
}

async function fetchSessions(userId: string, since: Date | null): Promise<SessionRow[]> {
  const supabase = await createClient();
  const q = supabase.from("sessions").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(1000);
  // Si la columna date no existe en algún entorno, el order fallaría; reintentamos sin order.
  const { data: initialData, error: initialError } = await q;
  let data = initialData;
  if (initialError) {
    const retry = await supabase.from("sessions").select("*").eq("user_id", userId).limit(1000);
    if (retry.error) throw retry.error;
    data = retry.data;
  }
  const rows = (data ?? []) as SessionRow[];
  if (!since) return rows;
  return rows.filter((s) => {
    const iso = sessionDateISO(s);
    if (!iso) return false;
    return new Date(iso).getTime() >= since.getTime();
  });
}

async function getCompletedSeries(sessionIds: string[]): Promise<SeriesRow[]> {
  if (sessionIds.length === 0) return [];
  const key = [...sessionIds].sort().join(",");
  const existing = seriesInflight.get(key);
  if (existing) return existing;
  const pending = fetchCompletedSeries(sessionIds).finally(() => {
    if (seriesInflight.get(key) === pending) seriesInflight.delete(key);
  });
  seriesInflight.set(key, pending);
  return pending;
}

async function fetchCompletedSeries(sessionIds: string[]): Promise<SeriesRow[]> {
  const supabase = await createClient();
  // En lotes para evitar URLs largar con .in()
  const chunks: string[][] = [];
  for (let i = 0; i < sessionIds.length; i += 100) chunks.push(sessionIds.slice(i, i + 100));
  const out: SeriesRow[] = [];
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("session_series")
      .select("*")
      .in("session_id", chunk)
      .eq("completed", true)
      .limit(5000);
    if (error) throw error;
    out.push(...((data ?? []) as SeriesRow[]));
  }
  return out;
}

function sessionIdOf(r: SeriesRow): string | null {
  return r.session_id ?? r.sessionId ?? null;
}
function exerciseIdOf(r: SeriesRow): string | null {
  return r.exercise_id ?? r.exerciseId ?? null;
}
function weightOf(r: SeriesRow): number | null {
  const v = r.weight_used ?? r.weight ?? null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}
function repsOf(r: SeriesRow): number | null {
  const v = r.reps_performed ?? r.reps ?? null;
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

// ---------- API pública (Columna A: todo calculado en cliente) ----------

export async function getTrainedExercises(userId: string): Promise<TrainedExercise[]> {
  const sessions = await getSessions(userId, null);
  const byId = new Map<string, SessionRow>(sessions.map((s) => [String(s.id), s]));
  const series = await getCompletedSeries([...byId.keys()]);

  const ids = [...new Set(series.map(exerciseIdOf).filter((x): x is string => !!x))];
  if (ids.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").select("*").in("id", ids.slice(0, 200));
  if (error) throw error;
  const exById = new Map<string, ExerciseRow>(((data ?? []) as ExerciseRow[]).map((e) => [String(e.id), e]));

  // sesiones distintas por ejercicio + última fecha
  const agg = new Map<string, { sessions: Set<string>; last: string | null }>();
  for (const r of series) {
    const exId = exerciseIdOf(r);
    const sId = sessionIdOf(r);
    if (!exId || !sId) continue;
    if (!agg.has(exId)) agg.set(exId, { sessions: new Set(), last: null });
    const a = agg.get(exId)!;
    a.sessions.add(sId);
    const iso = sessionDateISO(byId.get(sId) ?? {});
    if (iso && (!a.last || new Date(iso) > new Date(a.last))) a.last = iso;
  }

  return [...agg.entries()]
    .map(([id, a]) => ({
      id,
      name: String(exById.get(id)?.name ?? "Ejercicio"),
      muscle: (exById.get(id)?.muscle as string | null) ?? null,
      sessionsCount: a.sessions.size,
      lastDate: a.last,
    }))
    .sort((x, y) => y.sessionsCount - x.sessionsCount);
}

export async function getExerciseHistory(
  userId: string,
  exerciseId: string,
  range: ProgressRangeKey
): Promise<ExerciseHistoryPoint[]> {
  const since = rangeToSince(range);
  const sessions = await getSessions(userId, since);
  const byId = new Map<string, SessionRow>(sessions.map((s) => [String(s.id), s]));
  const series = await getCompletedSeries([...byId.keys()]);
  const filtered = series.filter((r) => exerciseIdOf(r) === exerciseId);

  // Mejor serie por sesión (mayor e1RM, fallback volumen)
  const bestBySession = new Map<string, ExerciseHistoryPoint>();
  for (const r of filtered) {
    const sId = sessionIdOf(r);
    if (!sId) continue;
    const sISO = sessionDateISO(byId.get(sId) ?? {});
    if (!sISO) continue;
    const w = weightOf(r);
    const reps = repsOf(r);
    const volume = w != null && reps != null ? w * reps : 0;
    const e1rm = estimate1RM(w, reps);
    const point: ExerciseHistoryPoint = { date: sISO, sessionId: sId, weight: w, reps, volume, e1rm };
    const prev = bestBySession.get(sId);
    if (!prev) {
      bestBySession.set(sId, point);
    } else {
      const score = (p: ExerciseHistoryPoint) => (p.e1rm ?? p.weight ?? p.volume);
      if (score(point) > score(prev)) bestBySession.set(sId, point);
    }
  }

  return [...bestBySession.values()].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

export async function getMuscleDistribution(
  userId: string,
  range: ProgressRangeKey
): Promise<MuscleSlice[]> {
  const since = rangeToSince(range);
  const sessions = await getSessions(userId, since);
  const byId = new Map<string, SessionRow>(sessions.map((s) => [String(s.id), s]));
  const sessionIds = [...byId.keys()];
  const series = await getCompletedSeries(sessionIds);
  if (series.length === 0) return [];

  const supabase = await createClient();
  const exIds = [...new Set(series.map(exerciseIdOf).filter((x): x is string => !!x))].slice(0, 300);
  let muscleByEx = new Map<string, string | null>();
  if (exIds.length > 0) {
    const { data, error } = await supabase.from("exercises").select("id,muscle").in("id", exIds);
    if (error) throw error;
    muscleByEx = new Map(((data ?? []) as ExerciseRow[]).map((e) => [String(e.id), (e.muscle as string | null) ?? null]));
  }

  const agg = new Map<string, MuscleSlice & { sessionSet: Set<string> }>();
  for (const r of series) {
    const exId = exerciseIdOf(r);
    const sId = sessionIdOf(r);
    const group = normalizeMuscleGroup(exId ? muscleByEx.get(exId) ?? null : null);
    if (!group) continue;
    if (!agg.has(group)) agg.set(group, { group, series: 0, volume: 0, sessions: 0, sessionSet: new Set() });
    const a = agg.get(group)!;
    a.series += 1;
    const w = weightOf(r);
    const reps = repsOf(r);
    if (w != null && reps != null) a.volume += w * reps;
    if (sId) a.sessionSet.add(sId);
  }

  return [...agg.values()]
    .map(({ sessionSet, ...rest }) => ({ ...rest, sessions: sessionSet.size, volume: Math.round(rest.volume) }))
    .sort((a, b) => b.series - a.series);
}

export async function getTrainingDays(userId: string, range: ProgressRangeKey = "all"): Promise<TrainingDay[]> {
  const since = range === "all" ? null : rangeToSince(range);
  const sessions = await getSessions(userId, since);
  if (sessions.length === 0) return [];

  // Solo días con al menos 1 serie completada si hay datos; si no, todas las sesiones.
  let completedSet: Set<string> | null = null;
  try {
    const series = await getCompletedSeries(sessions.map((s) => String(s.id)));
    if (series.length > 0) {
      completedSet = new Set(series.map(sessionIdOf).filter((x): x is string => !!x).map(String));
    }
  } catch {
    completedSet = null;
  }

  const byDay = new Map<string, number>();
  for (const s of sessions) {
    if (completedSet && !completedSet.has(String(s.id))) continue;
    const key = dayKeyFromISO(sessionDateISO(s));
    if (!key) continue;
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  return [...byDay.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export async function getWeeklyStreak(userId: string): Promise<StreakInfo> {
  const days = await getTrainingDays(userId, "all");
  return calcWeeklyStreak(days.map((d) => d.date));
}

export async function getProgressSummary(userId: string) {
  const [days, sessions90] = await Promise.all([
    getTrainingDays(userId, "all"),
    getSessions(userId, rangeToSince("30d")),
  ]);
  const streak = calcWeeklyStreak(days.map((d) => d.date));
  return {
    totalSessions: (await getSessions(userId, null)).length,
    sessionsLast30: sessions90.length,
    activeDays: days.length,
    streak,
  };
}

export async function getDaySessions(userId: string, dayKey: string): Promise<DaySessionDetail[]> {  const sessions = await getSessions(userId, null);
  const daySessions = sessions.filter((s) => sessionDayKey(s) === dayKey);
  if (daySessions.length === 0) return [];

  const ids = daySessions.map((s) => String(s.id));
  const series = await getCompletedSeries(ids);

  const supabase = await createClient();
  const routineIds = [...new Set(daySessions.map((s) => s.routine_id).filter(Boolean))].map(String);
  let routineNames = new Map<string, string>();
  if (routineIds.length > 0) {
    const { data, error } = await supabase.from("routines").select("id,name").in("id", routineIds);
    if (error) throw error;
    routineNames = new Map(((data ?? []) as { id: string; name: string }[]).map((r) => [String(r.id), r.name]));
  }

  return daySessions.map((s) => {
    const sId = String(s.id);
    const sSeries = series.filter((r) => sessionIdOf(r) === sId);
    const volume = Math.round(
      sSeries.reduce((acc, r) => {
        const w = weightOf(r);
        const reps = repsOf(r);
        return acc + (w != null && reps != null ? w * reps : 0);
      }, 0)
    );
    const exercises = new Set(sSeries.map(exerciseIdOf).filter((x): x is string => !!x));
    const routineId = s.routine_id != null ? String(s.routine_id) : null;
    return {
      sessionId: sId,
      date: sessionDateISO(s) ?? dayKey,
      routineId,
      routineName: (routineId && routineNames.get(routineId)) || "Sesión",
      seriesCount: sSeries.length,
      exercisesCount: exercises.size,
      volume,
    };
  });
}

export async function getVolumeHistory(userId: string, range: ProgressRangeKey): Promise<VolumePoint[]> {
  const since = rangeToSince(range);
  const sessions = await getSessions(userId, since);
  const byId = new Map<string, SessionRow>(sessions.map((s) => [String(s.id), s]));
  const series = await getCompletedSeries([...byId.keys()]);

  const byDay = new Map<string, { volume: number; sessions: Set<string> }>();
  for (const r of series) {
    const sId = sessionIdOf(r);
    if (!sId) continue;
    const key = sessionDayKey(byId.get(sId) ?? {});
    if (!key) continue;
    if (!byDay.has(key)) byDay.set(key, { volume: 0, sessions: new Set() });
    const agg = byDay.get(key)!;
    const w = weightOf(r);
    const reps = repsOf(r);
    if (w != null && reps != null) agg.volume += w * reps;
    agg.sessions.add(sId);
  }

  return [...byDay.entries()]
    .map(([date, agg]) => ({ date, volume: Math.round(agg.volume), sessions: agg.sessions.size }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export async function getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
  const sessions = await getSessions(userId, null);
  const byId = new Map<string, SessionRow>(sessions.map((s) => [String(s.id), s]));
  const series = await getCompletedSeries([...byId.keys()]);
  if (series.length === 0) return [];

  const supabase = await createClient();
  const exIds = [...new Set(series.map(exerciseIdOf).filter((x): x is string => !!x))].slice(0, 300);
  let nameByEx = new Map<string, { name: string; muscle: string | null }>();
  if (exIds.length > 0) {
    const { data, error } = await supabase.from("exercises").select("id,name,muscle").in("id", exIds);
    if (error) throw error;
    nameByEx = new Map(
      ((data ?? []) as ExerciseRow[]).map((e) => [
        String(e.id),
        { name: String(e.name ?? "Ejercicio"), muscle: (e.muscle as string | null) ?? null },
      ])
    );
  }

  const best = new Map<string, PersonalRecord>();
  for (const r of series) {
    const exId = exerciseIdOf(r);
    const sId = sessionIdOf(r);
    if (!exId || !sId) continue;
    const w = weightOf(r);
    const reps = repsOf(r);
    const e1rm = estimate1RM(w, reps);
    if (e1rm == null) continue;
    const iso = sessionDateISO(byId.get(sId) ?? {});
    if (!iso) continue;
    const prev = best.get(exId);
    if (!prev || e1rm > prev.bestE1rm) {
      best.set(exId, {
        exerciseId: exId,
        name: nameByEx.get(exId)?.name ?? "Ejercicio",
        muscle: nameByEx.get(exId)?.muscle ?? null,
        bestE1rm: e1rm,
        bestWeight: w,
        bestReps: reps,
        achievedAt: iso,
      });
    }
  }

  return [...best.values()].sort((a, b) => b.bestE1rm - a.bestE1rm);
}
