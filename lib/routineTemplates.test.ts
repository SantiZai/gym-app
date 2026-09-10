import { describe, expect, it } from "vitest";
import { matchTemplateExercises, ROUTINE_TEMPLATES, type RoutineTemplate } from "./routineTemplates";
import catalogJson from "../ejercicios_gimnasio.json";

const CATALOG = [
  { id: "a", name: "Barbell Full Squat" },
  { id: "b", name: "Pull-up" },
];

describe("matchTemplateExercises", () => {
  const template: RoutineTemplate = {
    key: "t",
    name: "T",
    description: "",
    category: "C",
    exercises: [
      { name: "Barbell Full Squat", sets: 3, reps: 8 },
      { name: "Inexistente", sets: 2, reps: 10 },
    ],
  };

  it("matchea ignorando mayúsculas y asigna orden", () => {
    const { matched, missing } = matchTemplateExercises(
      { ...template, exercises: [{ name: "barbell full squat", sets: 3, reps: 8 }] },
      CATALOG
    );
    expect(missing).toEqual([]);
    expect(matched).toEqual([
      { exerciseId: "a", name: "Barbell Full Squat", orden: 1, sets: 3, reps: 8, note: null },
    ]);
  });

  it("reporta los faltantes sin romper los matcheados", () => {
    const { matched, missing } = matchTemplateExercises(template, CATALOG);
    expect(matched).toHaveLength(1);
    expect(missing).toEqual(["Inexistente"]);
  });

  it("todas las plantillas matchean el catálogo curado", () => {
    const catalog = (
      Object.values(catalogJson.musculos) as { nombre: string }[][]
    )
      .flat()
      .map((e) => ({ id: e.nombre, name: e.nombre }));
    expect(catalog.length).toBeGreaterThan(0);
    for (const t of ROUTINE_TEMPLATES) {
      const { missing } = matchTemplateExercises(t, catalog);
      expect(missing).toEqual([]);
    }
  });

  it("las plantillas tienen 4 series sin pesos ni reps prefijados", () => {
    expect(ROUTINE_TEMPLATES).toHaveLength(3);
    for (const t of ROUTINE_TEMPLATES) {
      expect(t.exercises.length).toBeGreaterThan(0);
      for (const e of t.exercises) {
        expect(e.sets).toBe(4);
        expect(e.reps).toBeNull();
      }
    }
  });
});
