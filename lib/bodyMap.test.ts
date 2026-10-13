import { describe, expect, it } from "vitest";
import { BODY_BLUE_SCALE, MUSCLE_SLUES, muscleOfSlug, intensityLevel, rangeDescription } from "./bodyMap";
import { MUSCLES } from "./muscles";

describe("bodyMap", () => {
  it("cubre los 16 músculos con slugs válidos", () => {
    expect(Object.keys(MUSCLE_SLUES).sort()).toEqual(MUSCLES.map((m) => m.slug).sort());
    for (const slugs of Object.values(MUSCLE_SLUES)) {
      expect(slugs.length).toBeGreaterThan(0);
    }
  });

  it("resuelve slug del modelo al músculo preciso", () => {
    expect(muscleOfSlug("chest")).toBe("pectoral");
    expect(muscleOfSlug("biceps")).toBe("biceps");
    expect(muscleOfSlug("triceps")).toBe("triceps");
    expect(muscleOfSlug("front-deltoids")).toBe("deltoides-anterior");
    expect(muscleOfSlug("back-deltoids")).toBe("deltoides-posterior");
    expect(muscleOfSlug("upper-back")).toBe("dorsal");
    expect(muscleOfSlug("lower-back")).toBe("lumbares");
    expect(muscleOfSlug("quadriceps")).toBe("cuadriceps");
    expect(muscleOfSlug("hamstring")).toBe("isquiotibiales");
    expect(muscleOfSlug("calves")).toBe("gemelos");
    expect(muscleOfSlug("gluteal")).toBe("gluteos");
    expect(muscleOfSlug("head")).toBeNull();
  });

  it("niveles de intensidad 0..5", () => {
    expect(intensityLevel(0)).toBe(0);
    expect(intensityLevel(-1)).toBe(0);
    expect(intensityLevel(NaN)).toBe(0);
    expect(intensityLevel(0.01)).toBe(1);
    expect(intensityLevel(1)).toBe(5);
    expect(intensityLevel(2)).toBe(5);
    expect(BODY_BLUE_SCALE).toHaveLength(5);
  });

  it("describe cada período", () => {
    expect(rangeDescription("week")).toBe("esta semana");
    expect(rangeDescription("30d")).toContain("30 días");
    expect(rangeDescription("90d")).toContain("90 días");
    expect(rangeDescription("all")).toContain("historial");
  });
});
