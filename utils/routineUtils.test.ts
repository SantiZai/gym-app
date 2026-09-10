import { describe, expect, it } from "vitest";
import { extractRutinaId } from "./routineUtils";

describe("extractRutinaId", () => {
  it("acepta array de filas", () => {
    expect(extractRutinaId([{ rutina_id: "abc" }])).toBe("abc");
  });

  it("acepta objeto único", () => {
    expect(extractRutinaId({ rutina_id: "abc" })).toBe("abc");
  });

  it("rechaza respuestas vacías o sin id", () => {
    expect(() => extractRutinaId([])).toThrow();
    expect(() => extractRutinaId(null)).toThrow();
    expect(() => extractRutinaId(undefined)).toThrow();
    expect(() => extractRutinaId([{}])).toThrow();
    expect(() => extractRutinaId([{ rutina_id: "" }])).toThrow();
  });
});
