import { describe, expect, it } from "vitest";
import { extractRutinaId, tryExtractRutinaId } from "./routineUtils";

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

  it("rescata el id vía snapshot si la lectura directa falla", () => {
    let reads = 0;
    const tricky = [
      {
        get rutina_id() {
          reads += 1;
          return reads === 1 ? undefined : "abc";
        },
      },
    ];
    expect(extractRutinaId(tricky as unknown)).toBe("abc");
  });

  it("tryExtractRutinaId devuelve null sin lanzar", () => {
    expect(tryExtractRutinaId([{ rutina_id: "abc" }])).toBe("abc");
    expect(tryExtractRutinaId([])).toBeNull();
    expect(tryExtractRutinaId(null)).toBeNull();
  });
});
