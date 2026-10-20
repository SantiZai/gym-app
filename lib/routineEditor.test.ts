import { describe, expect, it } from "vitest";
import { buildRoutinePayload, createDefaultSeries, isTempId } from "./routineEditor";
import type { EditableRoutine } from "@/types/routine";

describe("routineEditor", () => {
  it("normaliza orden y descarta ids temporales al armar el payload", () => {
    const series = createDefaultSeries(2, "12", "40");
    const routine: EditableRoutine = {
      id: null,
      name: "  Push A  ",
      description: "  ",
      public: false,
      exercises: [
        {
          exercise_id: "ex-1",
          name: "Press de banca",
          primary_muscle_id: "pectoral",
          secondary_muscle_ids: ["triceps"],
          type: "strength",
          equipment: "barbell",
          instructions: null,
          routine_exercise_id: null,
          orden: 9,
          notes: "  técnica  ",
          series: [
            ...series,
            { id: "real-serie", type: "warm-up", reps: "", weight: "", orden: 30, notes: null },
          ],
        },
      ],
    };

    const payload = buildRoutinePayload(routine);

    expect(payload.nombre).toBe("Push A");
    expect(payload.descripcion).toBeNull();
    expect(payload.ejercicios[0].orden).toBe(1);
    expect(payload.ejercicios[0].notas).toBe("técnica");
    expect(payload.ejercicios[0].series.map((serie) => serie.orden)).toEqual([1, 2, 3]);
    expect(payload.ejercicios[0].series[0].serie_id).toBeNull();
    expect(payload.ejercicios[0].series[2].serie_id).toBe("real-serie");
    expect(payload.ejercicios[0].series[2].reps).toBe("0");
    expect(payload.ejercicios[0].series[2].weight).toBe("0");
  });

  it("detecta ids temporales", () => {
    expect(isTempId("temp-abc")).toBe(true);
    expect(isTempId("6f1c0f2e-0000-4000-8000-000000000000")).toBe(false);
  });
});
