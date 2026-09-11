import { describe, expect, it } from "vitest";
import {
  formatDayMonth,
  summarizeSessions,
  toShareModelData,
  topMuscleGroups,
} from "./shareImage";
import type { DaySessionDetail, MuscleSlice } from "@/types/progress";

const MUSCLES: MuscleSlice[] = [
  { group: "Piernas", series: 40, volume: 8000, sessions: 8 },
  { group: "Espalda", series: 20, volume: 4000, sessions: 5 },
  { group: "Pecho", series: 10, volume: 2000, sessions: 3 },
  { group: "Core", series: 0, volume: 0, sessions: 0 },
];

describe("toShareModelData", () => {
  it("mapea grupos a slugs con intensidad relativa al máximo", () => {
    const data = toShareModelData(MUSCLES);
    const piernas = data.find((d) => d.name === "Piernas");
    expect(piernas?.frequency).toBe(5);
    expect(piernas?.muscles).toContain("quadriceps");
    const pecho = data.find((d) => d.name === "Pecho");
    expect(pecho!.frequency).toBeGreaterThan(0);
    expect(pecho!.frequency).toBeLessThan(5);
  });

  it("omite grupos sin series y devuelve vacío sin datos", () => {
    const data = toShareModelData(MUSCLES);
    expect(data.find((d) => d.name === "Core")).toBeUndefined();
    expect(toShareModelData([])).toEqual([]);
  });
});

describe("topMuscleGroups", () => {
  it("ordena por series y limita a n", () => {
    const top = topMuscleGroups(MUSCLES, 2);
    expect(top.map((m) => m.group)).toEqual(["Piernas", "Espalda"]);
  });

  it("excluye grupos sin series", () => {
    expect(topMuscleGroups(MUSCLES).find((m) => m.group === "Core")).toBeUndefined();
  });
});

describe("formatDayMonth", () => {
  it("formatea yyyy-mm-dd en español", () => {
    const out = formatDayMonth("2026-09-10");
    expect(out).toContain("10");
    expect(out).not.toBe("2026-09-10");
  });
});

const DETAIL = (over: Partial<DaySessionDetail>): DaySessionDetail => ({
  sessionId: "s1",
  date: "2026-09-10T18:00:00",
  routineId: "r1",
  routineName: "Pecho y tríceps",
  seriesCount: 18,
  exercisesCount: 6,
  volume: 2450,
  ...over,
});

describe("summarizeSessions", () => {
  it("resume una sola sesión con su nombre", () => {
    const s = summarizeSessions([DETAIL({})]);
    expect(s?.title).toBe("Pecho y tríceps");
    expect(s?.dateKey).toBe("2026-09-10");
    expect(s?.exercisesCount).toBe(6);
    expect(s?.seriesCount).toBe(18);
    expect(s?.volume).toBe(2450);
  });

  it("agrega varias sesiones del mismo día", () => {
    const s = summarizeSessions([
      DETAIL({ sessionId: "s1", routineName: "Pecho", seriesCount: 10, exercisesCount: 4, volume: 1000 }),
      DETAIL({ sessionId: "s2", routineName: "Piernas", seriesCount: 8, exercisesCount: 3, volume: 2000 }),
    ]);
    expect(s?.sessionsCount).toBe(2);
    expect(s?.seriesCount).toBe(18);
    expect(s?.volume).toBe(3000);
    expect(s?.title).toContain("Pecho");
  });

  it("devuelve null sin sesiones", () => {
    expect(summarizeSessions([])).toBeNull();
  });
});
