import type { TrainerScheduleEntry } from "@/types/db";

export const WEEK_DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
export const WEEK_DAYS_LONG = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

/** Valida un horario semanal: días 0-6, formato HH:MM, inicio < fin, sin solapes por día. */
export function validateSchedule(schedule: unknown): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(schedule)) return { ok: false, error: "Horario inválido" };
  const entries = schedule as TrainerScheduleEntry[];

  for (const e of entries) {
    if (!e || typeof e.day !== "number" || e.day < 0 || e.day > 6 || !Number.isInteger(e.day)) {
      return { ok: false, error: "Día inválido (0-6)" };
    }
    if (!isValidTime(e.start) || !isValidTime(e.end)) {
      return { ok: false, error: "Hora inválida (HH:MM)" };
    }
    if (e.start >= e.end) {
      return { ok: false, error: `El inicio debe ser menor al fin (${WEEK_DAYS_SHORT[e.day]})` };
    }
  }

  const byDay = new Map<number, { start: string; end: string }[]>();
  for (const e of entries) {
    const list = byDay.get(e.day) ?? [];
    for (const o of list) {
      if (e.start < o.end && o.start < e.end) {
        return { ok: false, error: `Horarios solapados el ${WEEK_DAYS_LONG[e.day]}` };
      }
    }
    list.push({ start: e.start, end: e.end });
    byDay.set(e.day, list);
  }

  return { ok: true };
}

/** "Lun 08:00–12:00, Mié 18:00–20:00" ordenado por día. Vacío → "Sin horarios". */
export function formatSchedule(schedule: TrainerScheduleEntry[] | null | undefined): string {
  return formatScheduleLines(schedule).join(", ") || "Sin horarios";
}

/** Una línea por día: ["Lun 08:00–12:00", "Mié 18:00–20:00"]. Vacío → []. */
export function formatScheduleLines(
  schedule: TrainerScheduleEntry[] | null | undefined
): string[] {
  if (!schedule || schedule.length === 0) return [];
  const byDay = new Map<number, string[]>();
  const sorted = [...schedule].sort((a, b) => a.day - b.day || (a.start < b.start ? -1 : 1));
  for (const e of sorted) {
    const list = byDay.get(e.day) ?? [];
    list.push(`${e.start}–${e.end}`);
    byDay.set(e.day, list);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, ranges]) => `${WEEK_DAYS_SHORT[day]} ${ranges.join(", ")}`);
}

/** Agrupa por día para la vista de grilla: Map<day, "08:00–12:00, 18:00–20:00">. */
export function groupScheduleByDay(
  schedule: TrainerScheduleEntry[] | null | undefined
): Map<number, string> {
  const out = new Map<number, string>();
  if (!schedule) return out;
  const byDay = new Map<number, string[]>();
  for (const e of schedule) {
    const list = byDay.get(e.day) ?? [];
    list.push(`${e.start}–${e.end}`);
    byDay.set(e.day, list);
  }
  for (const [day, ranges] of byDay) {
    out.set(day, [...ranges].sort().join(", "));
  }
  return out;
}
