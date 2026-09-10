export interface RoutineHistory {
  total: number;
  last: string | null; // ISO de la última sesión
  monthCount: number; // sesiones en el mes calendario actual
}

interface SessionLike {
  routine_id: string | null;
  date: string;
}

/** Agrega sesiones por rutina: última vez, total y veces este mes. */
export function aggregateRoutineHistory(
  sessions: SessionLike[],
  now: Date = new Date()
): Record<string, RoutineHistory> {
  const out: Record<string, RoutineHistory> = {};
  const month = now.getMonth();
  const year = now.getFullYear();

  for (const s of sessions) {
    if (!s.routine_id || !s.date) continue;
    const d = new Date(s.date);
    if (Number.isNaN(d.getTime())) continue;
    const prev = out[s.routine_id] ?? { total: 0, last: null, monthCount: 0 };
    prev.total += 1;
    if (!prev.last || d.getTime() > new Date(prev.last).getTime()) prev.last = s.date;
    if (d.getMonth() === month && d.getFullYear() === year) prev.monthCount += 1;
    out[s.routine_id] = prev;
  }

  return out;
}
