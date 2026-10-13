import { describe, expect, it } from "vitest";
import {
  MUSCLES,
  MUSCLE_BY_SLUG,
  MUSCLE_SLUGS,
  isMuscleSlug,
  muscleColor,
  muscleName,
  normalizeMuscle,
} from "./muscles";

describe("taxonomía de músculos", () => {
  it("tiene 16 músculos con slugs únicos y colores propios", () => {
    expect(MUSCLES).toHaveLength(16);
    expect(new Set(MUSCLE_SLUGS).size).toBe(16);
    expect(new Set(MUSCLES.map((m) => m.color)).size).toBe(16);
    for (const m of MUSCLES) {
      expect(MUSCLE_BY_SLUG[m.slug]).toEqual(m);
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.region.length).toBeGreaterThan(0);
    }
  });

  it("separa brazos en bíceps/tríceps/antebrazo y hombros en 3 deltoides", () => {
    expect(MUSCLE_SLUGS).toContain("biceps");
    expect(MUSCLE_SLUGS).toContain("triceps");
    expect(MUSCLE_SLUGS).toContain("antebrazo");
    expect(MUSCLE_SLUGS).toContain("deltoides-anterior");
    expect(MUSCLE_SLUGS).toContain("deltoides-medio");
    expect(MUSCLE_SLUGS).toContain("deltoides-posterior");
    expect(MUSCLE_SLUGS).not.toContain("brazos" as never);
    expect(MUSCLE_SLUGS).not.toContain("hombros" as never);
  });

  it("resuelve nombre y color, con fallback gris", () => {
    expect(muscleName("biceps")).toBe("Bíceps");
    expect(muscleName("deltoides-medio")).toBe("Deltoides medio");
    expect(muscleName(null)).toBe("—");
    expect(muscleColor("biceps")).toBe("#ec4899");
    expect(muscleColor("desconocido")).toBe("#94a3b8");
    expect(isMuscleSlug("biceps")).toBe(true);
    expect(isMuscleSlug("brazos")).toBe(false);
    expect(isMuscleSlug(null)).toBe(false);
  });
});

describe("normalizeMuscle", () => {
  it("mapea valores en inglés de API Ninjas al músculo exacto", () => {
    expect(normalizeMuscle("chest")).toBe("pectoral");
    expect(normalizeMuscle("lats")).toBe("dorsal");
    expect(normalizeMuscle("traps")).toBe("trapecio");
    expect(normalizeMuscle("quadriceps")).toBe("cuadriceps");
    expect(normalizeMuscle("hamstrings")).toBe("isquiotibiales");
    expect(normalizeMuscle("biceps")).toBe("biceps");
    expect(normalizeMuscle("triceps")).toBe("triceps");
    expect(normalizeMuscle("forearms")).toBe("antebrazo");
    expect(normalizeMuscle("abdominals")).toBe("abdominales");
    expect(normalizeMuscle("glutes")).toBe("gluteos");
    expect(normalizeMuscle("calves")).toBe("gemelos");
    expect(normalizeMuscle("lower_back")).toBe("lumbares");
    expect(normalizeMuscle("shoulders")).toBe("deltoides-medio");
  });

  it("mapea español preciso del JSON curado", () => {
    expect(normalizeMuscle("Pectoral mayor")).toBe("pectoral");
    expect(normalizeMuscle("Dorsal ancho")).toBe("dorsal");
    expect(normalizeMuscle("Deltoides anterior")).toBe("deltoides-anterior");
    expect(normalizeMuscle("Deltoides medio")).toBe("deltoides-medio");
    expect(normalizeMuscle("Biceps braquial")).toBe("biceps");
    expect(normalizeMuscle("Triceps braquial")).toBe("triceps");
    expect(normalizeMuscle("Braquiorradial")).toBe("antebrazo");
    expect(normalizeMuscle("Cuadriceps")).toBe("cuadriceps");
    expect(normalizeMuscle("Isquiotibiales")).toBe("isquiotibiales");
    expect(normalizeMuscle("Gluteo mayor")).toBe("gluteos");
    expect(normalizeMuscle("Recto abdominal")).toBe("abdominales");
    expect(normalizeMuscle("Erectores espinales")).toBe("lumbares");
    expect(normalizeMuscle("Gemelos")).toBe("gemelos");
    expect(normalizeMuscle("Soleo")).toBe("gemelos");
    expect(normalizeMuscle("Trapecio")).toBe("trapecio");
  });

  it("ignora mayúsculas, espacios y guiones", () => {
    expect(normalizeMuscle("CUADRICEPS")).toBe("cuadriceps");
    expect(normalizeMuscle("  Triceps  ")).toBe("triceps");
    expect(normalizeMuscle("lower back")).toBe("lumbares");
    expect(normalizeMuscle("middle_back")).toBe("trapecio");
  });

  it("devuelve null sin dato o con músculo desconocido", () => {
    expect(normalizeMuscle(null)).toBeNull();
    expect(normalizeMuscle(undefined)).toBeNull();
    expect(normalizeMuscle("")).toBeNull();
    expect(normalizeMuscle("tibialis")).toBeNull();
  });

  it("todo valor normalizado pertenece al catálogo", () => {
    for (const raw of ["chest", "biceps", "glutes", "abdominals", "traps", "calves", "neck", "Pectoral mayor"]) {
      expect(MUSCLE_SLUGS).toContain(normalizeMuscle(raw));
    }
  });
});
