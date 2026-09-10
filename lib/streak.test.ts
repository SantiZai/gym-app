import { describe, expect, it } from "vitest";
import {
  calcWeeklyStreak,
  dayKeyFromISO,
  getMonday,
  parseDayKey,
  toDayKey,
} from "./streak";

// 2026-09-10 es jueves → el lunes de su semana es 2026-09-07
const NOW = new Date(2026, 8, 10, 12, 0, 0);

describe("getMonday", () => {
  it("devuelve el lunes de la semana", () => {
    expect(toDayKey(getMonday(NOW))).toBe("2026-09-07");
  });

  it("un lunes se devuelve a sí mismo", () => {
    expect(toDayKey(getMonday(new Date(2026, 8, 7, 18, 30)))).toBe("2026-09-07");
  });

  it("un domingo pertenece a la semana del lunes previo", () => {
    expect(toDayKey(getMonday(new Date(2026, 8, 13, 10, 0)))).toBe("2026-09-07");
  });
});

describe("dayKeyFromISO / parseDayKey", () => {
  it("convierte un ISO a yyyy-mm-dd", () => {
    expect(dayKeyFromISO("2026-09-10T15:00:00.000Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("devuelve null con entradas inválidas", () => {
    expect(dayKeyFromISO(null)).toBeNull();
    expect(dayKeyFromISO(undefined)).toBeNull();
    expect(dayKeyFromISO("no-fecha")).toBeNull();
  });

  it("parseDayKey revierte toDayKey", () => {
    const key = toDayKey(NOW);
    const back = parseDayKey(key);
    expect(toDayKey(back)).toBe(key);
  });
});

describe("calcWeeklyStreak", () => {
  it("sin entrenos da racha 0 y 16 semanas", () => {
    const s = calcWeeklyStreak([], { now: NOW });
    expect(s.current).toBe(0);
    expect(s.best).toBe(0);
    expect(s.weeks).toHaveLength(16);
    expect(s.weeks.at(-1)?.weekStart).toBe("2026-09-07");
  });

  it("solo la semana actual entrenada cuenta 1", () => {
    const s = calcWeeklyStreak(["2026-09-08"], { now: NOW });
    expect(s.current).toBe(1);
    expect(s.best).toBe(1);
  });

  it("la semana actual vacía no rompe la racha", () => {
    const s = calcWeeklyStreak(["2026-09-02", "2026-08-26"], { now: NOW });
    expect(s.current).toBe(2);
    expect(s.best).toBe(2);
  });

  it("una semana vacía corta la racha actual", () => {
    // actual + semana del 17/8 sí, semanas intermedias no
    const s = calcWeeklyStreak(["2026-09-08", "2026-08-19"], { now: NOW });
    expect(s.current).toBe(1);
    expect(s.best).toBe(1);
  });

  it("la mejor racha histórica se conserva aunque la actual sea 0", () => {
    const s = calcWeeklyStreak(["2026-08-05", "2026-08-12", "2026-08-19"], { now: NOW });
    expect(s.current).toBe(0);
    expect(s.best).toBe(3);
  });

  it("varios entrenos en la misma semana cuentan una sola vez", () => {
    const s = calcWeeklyStreak(["2026-09-07", "2026-09-09", "2026-09-10"], { now: NOW });
    expect(s.current).toBe(1);
  });
});
