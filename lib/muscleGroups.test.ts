import { describe, expect, it } from "vitest";
import { MUSCLE_GROUPS, normalizeMuscleGroup } from "./muscleGroups";

describe("normalizeMuscleGroup", () => {
  it("mapea valores en inglés de API Ninjas", () => {
    expect(normalizeMuscleGroup("chest")).toBe("Pecho");
    expect(normalizeMuscleGroup("lats")).toBe("Espalda");
    expect(normalizeMuscleGroup("quadriceps")).toBe("Piernas");
    expect(normalizeMuscleGroup("biceps")).toBe("Brazos");
    expect(normalizeMuscleGroup("abdominals")).toBe("Core");
    expect(normalizeMuscleGroup("glutes")).toBe("Glúteos");
    expect(normalizeMuscleGroup("shoulders")).toBe("Hombros");
  });

  it("mapea valores en español", () => {
    expect(normalizeMuscleGroup("Pecho")).toBe("Pecho");
    expect(normalizeMuscleGroup("piernas")).toBe("Piernas");
    expect(normalizeMuscleGroup("Glúteos")).toBe("Glúteos");
    expect(normalizeMuscleGroup("hombros")).toBe("Hombros");
  });

  it("ignora mayúsculas, espacios y guiones", () => {
    expect(normalizeMuscleGroup("CUADRICEPS")).toBe("Piernas");
    expect(normalizeMuscleGroup("  Triceps  ")).toBe("Brazos");
    expect(normalizeMuscleGroup("lower back")).toBe("Espalda");
    expect(normalizeMuscleGroup("middle_back")).toBe("Espalda");
  });

  it("devuelve null sin dato o con grupo desconocido", () => {
    expect(normalizeMuscleGroup(null)).toBeNull();
    expect(normalizeMuscleGroup(undefined)).toBeNull();
    expect(normalizeMuscleGroup("")).toBeNull();
    expect(normalizeMuscleGroup("tibialis")).toBeNull();
  });

  it("todo grupo normalizado pertenece al catálogo", () => {
    for (const raw of ["chest", "biceps", "glutes", "abdominals", "traps", "calves", "neck"]) {
      expect(MUSCLE_GROUPS).toContain(normalizeMuscleGroup(raw));
    }
  });
});
