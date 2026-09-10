import { describe, expect, it } from "vitest";
import { stepValue } from "./stepper";

describe("stepValue", () => {
  it("suma y resta el paso", () => {
    expect(stepValue("10", 1, 1)).toBe("11");
    expect(stepValue("10", 1, -1)).toBe("9");
    expect(stepValue("60", 2.5, 1)).toBe("62.5");
  });

  it("trata vacío o inválido como 0", () => {
    expect(stepValue("", 1, 1)).toBe("1");
    expect(stepValue("abc", 5, 1)).toBe("5");
  });

  it("acepta coma decimal y no baja del mínimo", () => {
    expect(stepValue("2,5", 2.5, 1)).toBe("5");
    expect(stepValue("0", 1, -1)).toBe("0");
    expect(stepValue("1", 5, -1)).toBe("0");
  });

  it("evita errores de punto flotante", () => {
    expect(stepValue("0.1", 0.2, 1)).toBe("0.3");
  });
});
