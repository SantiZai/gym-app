import { describe, expect, it } from "vitest";
import { formatSessionDuration } from "@/utils/sessionUtils";

describe("formatSessionDuration", () => {
  it("formatea interval HH:MM:SS de Postgres", () => {
    expect(formatSessionDuration("01:30:00", null, null)).toBe("1 h 30 min");
    expect(formatSessionDuration("00:45:20", null, null)).toBe("45 min");
    expect(formatSessionDuration("00:05:00", null, null)).toBe("5 min");
  });

  it("soporta intervalos con días", () => {
    expect(formatSessionDuration("2 days 01:00:00", null, null)).toBe("49 h 00 min");
    expect(formatSessionDuration("1 day 00:30:00", null, null)).toBe("24 h 30 min");
  });

  it("usa started/ended como fallback", () => {
    expect(formatSessionDuration(null, "2026-09-10T10:00:00", "2026-09-10T10:20:00")).toBe("20 min");
    expect(formatSessionDuration(null, "2026-09-10T10:00:00", "2026-09-10T11:05:00")).toBe("1 h 05 min");
  });

  it("devuelve — sin datos válidos", () => {
    expect(formatSessionDuration(null, null, null)).toBe("—");
    expect(formatSessionDuration("nope", null, null)).toBe("—");
  });
});
