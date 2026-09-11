import { describe, expect, it } from "vitest";
import { buildShareText } from "./share";

const RECORDS = [
  { exerciseId: "1", name: "Press banca", muscle: "Pecho", bestE1rm: 100, bestWeight: 90, bestReps: 5, achievedAt: "2026-09-01T10:00:00" },
  { exerciseId: "2", name: "Sentadilla", muscle: "Piernas", bestE1rm: 120, bestWeight: 100, bestReps: 5, achievedAt: "2026-09-02T10:00:00" },
];

describe("buildShareText", () => {
  it("incluye racha, sesiones y top de marcas", () => {
    const text = buildShareText({
      streak: { current: 4, best: 6, weeks: [] },
      records: RECORDS,
      totalSessions: 32,
      activeDays: 18,
    });
    expect(text).toContain("🔥 Racha: 4 semanas seguidas (récord: 6)");
    expect(text).toContain("💪 32 sesiones · 18 días activos");
    expect(text).toContain("• Press banca: 100 kg (1RM est.)");
    expect(text).toContain("• Sentadilla: 120 kg (1RM est.)");
  });

  it("usa singular cuando corresponde", () => {
    const text = buildShareText({
      streak: { current: 1, best: 1, weeks: [] },
      records: [],
      totalSessions: 1,
      activeDays: 1,
    });
    expect(text).toContain("1 semana seguida");
    expect(text).toContain("1 sesión · 1 día activo");
    expect(text).not.toContain("🏆");
  });

  it("omite la racha si es 0 y no hay marcas", () => {
    const text = buildShareText({ streak: null, records: [], totalSessions: 0, activeDays: 0 });
    expect(text).toContain("🏋️ Mi progreso en Habitus");
    expect(text).not.toContain("🔥");
    expect(text).not.toContain("🏆");
  });

  it("limita las marcas a 3", () => {
    const many = [0, 1, 2, 3, 4].map((i) => ({ ...RECORDS[0], exerciseId: String(i), name: `Ej ${i}` }));
    const text = buildShareText({ streak: null, records: many, totalSessions: 5, activeDays: 5 });
    expect(text).toContain("Ej 2");
    expect(text).not.toContain("Ej 3");
  });
});
