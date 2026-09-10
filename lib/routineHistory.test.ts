import { describe, expect, it } from "vitest";
import { aggregateRoutineHistory } from "./routineHistory";

const NOW = new Date(2026, 8, 10, 12, 0, 0); // 10 sep 2026

describe("aggregateRoutineHistory", () => {
  it("devuelve vacío sin sesiones", () => {
    expect(aggregateRoutineHistory([], NOW)).toEqual({});
  });

  it("agrega última vez, total y conteo del mes", () => {
    const out = aggregateRoutineHistory(
      [
        { routine_id: "a", date: "2026-09-02T10:00:00" },
        { routine_id: "a", date: "2026-09-08T10:00:00" },
        { routine_id: "a", date: "2026-08-20T10:00:00" },
        { routine_id: "b", date: "2026-07-01T10:00:00" },
      ],
      NOW
    );
    expect(out["a"]).toEqual({ total: 3, last: "2026-09-08T10:00:00", monthCount: 2 });
    expect(out["b"]).toEqual({ total: 1, last: "2026-07-01T10:00:00", monthCount: 0 });
  });

  it("ignora filas sin rutina o fecha inválida", () => {
    const out = aggregateRoutineHistory(
      [
        { routine_id: "", date: "2026-09-01T10:00:00" },
        { routine_id: "a", date: "no-fecha" },
      ],
      NOW
    );
    expect(out).toEqual({});
  });
});
