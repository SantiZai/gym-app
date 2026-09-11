import { describe, expect, it } from "vitest";
import { BODY_BLUE_SCALE, GROUP_SLUES, groupOfSlug, intensityLevel, rangeDescription } from "./bodyMap";
import { MUSCLE_GROUPS } from "./muscleGroups";

describe("bodyMap", () => {
  it("cubre las 8 zonas con slugs válidos", () => {
    expect(Object.keys(GROUP_SLUES).sort()).toEqual([...MUSCLE_GROUPS].sort());
    for (const slugs of Object.values(GROUP_SLUES)) {
      expect(slugs.length).toBeGreaterThan(0);
    }
  });

  it("resuelve slug a zona y viceversa", () => {
    expect(groupOfSlug("chest")).toBe("Pecho");
    expect(groupOfSlug("upper-back")).toBe("Espalda");
    expect(groupOfSlug("calves")).toBe("Gemelos");
    expect(groupOfSlug("gluteal")).toBe("Glúteos");
    expect(groupOfSlug("head")).toBeNull();
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
