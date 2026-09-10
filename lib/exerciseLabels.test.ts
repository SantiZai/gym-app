import { describe, expect, it } from "vitest";
import { equipmentLabel } from "./exerciseLabels";

describe("equipmentLabel", () => {
  it("traduce equipos comunes", () => {
    expect(equipmentLabel("dumbbell")).toBe("Mancuernas");
    expect(equipmentLabel("CABLE")).toBe("Polea");
    expect(equipmentLabel("  barbell  ")).toBe("Barra");
    expect(equipmentLabel("machine")).toBe("Máquina");
  });

  it("devuelve el original si no lo conoce y null sin dato", () => {
    expect(equipmentLabel("landmine")).toBe("landmine");
    expect(equipmentLabel(null)).toBeNull();
    expect(equipmentLabel(undefined)).toBeNull();
    expect(equipmentLabel("")).toBeNull();
  });
});
