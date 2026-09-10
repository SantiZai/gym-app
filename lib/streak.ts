import type { StreakInfo } from "@/types/progress";

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Lunes de la semana ISO (lun-dom) para una fecha dada. */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0=lunes
  d.setDate(d.getDate() - dow);
  return d;
}

/**
 * Racha de semanas seguidas entrenando (Columna A).
 * Regla: semana cuenta si tiene >=1 día entrenado. La semana actual no rompe racha.
 */
export function calcWeeklyStreak(
  trainingDayKeys: string[],
  opts: { weeksBack?: number; now?: Date } = {}
): StreakInfo {
  const weeksBack = opts.weeksBack ?? 16;
  const now = opts.now ?? new Date();
  const trained = new Set(trainingDayKeys);

  const thisMonday = getMonday(now);
  const weeks: { weekStart: string; trained: boolean }[] = [];

  for (let i = weeksBack - 1; i >= 0; i--) {
    const monday = new Date(thisMonday);
    monday.setDate(monday.getDate() - i * 7);
    const weekStart = toDayKey(monday);
    let hit = false;
    for (let d = 0; d < 7; d++) {
      const day = new Date(monday);
      day.setDate(day.getDate() + d);
      if (day > now) break;
      if (trained.has(toDayKey(day))) {
        hit = true;
        break;
      }
    }
    weeks.push({ weekStart, trained: hit });
  }

  // Racha actual: contar hacia atrás desde la semana actual,
  // ignorando la semana actual si aún no entrenó (no rompe).
  let current = 0;
  const newestFirst = [...weeks].reverse(); // semana actual primera
  let idx = 0;
  if (newestFirst.length > 0 && !newestFirst[0].trained) {
    idx = 1;
  }
  for (; idx < newestFirst.length; idx++) {
    if (newestFirst[idx].trained) current += 1;
    else break;
  }

  // Mejor racha histórica
  let best = 0;
  let run = 0;
  for (const w of weeks) {
    if (w.trained) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  return { current, best, weeks };
}

export function dayKeyFromISO(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return toDayKey(d);
}

export { parseDayKey };
