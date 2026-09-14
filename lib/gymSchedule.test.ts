import { describe, expect, it } from "vitest";
import { formatSchedule, groupScheduleByDay, validateSchedule } from "./gymSchedule";

describe("validateSchedule", () => {
  it("acepta un horario válido", () => {
    expect(
      validateSchedule([
        { day: 1, start: "08:00", end: "12:00" },
        { day: 3, start: "18:00", end: "20:00" },
      ])
    ).toEqual({ ok: true });
  });

  it("acepta lista vacía", () => {
    expect(validateSchedule([])).toEqual({ ok: true });
  });

  it("rechaza día fuera de rango", () => {
    expect(validateSchedule([{ day: 7, start: "08:00", end: "12:00" }]).ok).toBe(false);
  });

  it("rechaza hora malformada", () => {
    expect(validateSchedule([{ day: 1, start: "8:00", end: "12:00" }]).ok).toBe(false);
    expect(validateSchedule([{ day: 1, start: "08:00", end: "25:00" }]).ok).toBe(false);
  });

  it("rechaza inicio >= fin", () => {
    expect(validateSchedule([{ day: 1, start: "12:00", end: "08:00" }]).ok).toBe(false);
    expect(validateSchedule([{ day: 1, start: "08:00", end: "08:00" }]).ok).toBe(false);
  });

  it("rechaza solapes el mismo día pero permite días distintos", () => {
    expect(
      validateSchedule([
        { day: 1, start: "08:00", end: "12:00" },
        { day: 1, start: "11:00", end: "13:00" },
      ]).ok
    ).toBe(false);
    expect(
      validateSchedule([
        { day: 1, start: "08:00", end: "12:00" },
        { day: 2, start: "08:00", end: "12:00" },
      ])
    ).toEqual({ ok: true });
  });
});

describe("formatSchedule", () => {
  it("ordena por día y formatea", () => {
    expect(
      formatSchedule([
        { day: 3, start: "18:00", end: "20:00" },
        { day: 1, start: "08:00", end: "12:00" },
      ])
    ).toBe("Lun 08:00–12:00, Mié 18:00–20:00");
  });

  it("vacío o null → Sin horarios", () => {
    expect(formatSchedule([])).toBe("Sin horarios");
    expect(formatSchedule(null)).toBe("Sin horarios");
  });
});

describe("groupScheduleByDay", () => {
  it("agrupa rangos por día", () => {
    const grouped = groupScheduleByDay([
      { day: 1, start: "18:00", end: "20:00" },
      { day: 1, start: "08:00", end: "12:00" },
    ]);
    expect(grouped.get(1)).toBe("08:00–12:00, 18:00–20:00");
    expect(grouped.has(2)).toBe(false);
  });
});
