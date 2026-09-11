import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rangeToSince } from "./progressUtils";

describe("rangeToSince", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("week arranca el lunes 00:00 de esta semana", () => {
    vi.setSystemTime(new Date(2026, 8, 10, 12, 0, 0)); // jueves 10 sep 2026
    const since = rangeToSince("week");
    expect(since?.getDay()).toBe(1);
    expect(since?.getDate()).toBe(7);
    expect(since?.getHours()).toBe(0);
    expect(since?.getMinutes()).toBe(0);
  });

  it("domingo pertenece a la misma semana que su lunes", () => {
    vi.setSystemTime(new Date(2026, 8, 13, 20, 0, 0)); // domingo 13 sep 2026
    const since = rangeToSince("week");
    expect(since?.getDate()).toBe(7);
  });

  it("all es null y los rangos en días restan bien", () => {
    vi.setSystemTime(new Date(2026, 8, 10, 12, 0, 0));
    expect(rangeToSince("all")).toBeNull();
    const d30 = rangeToSince("30d");
    expect(d30?.getDate()).toBe(11);
    expect(d30?.getMonth()).toBe(7); // agosto
    expect(d30?.getHours()).toBe(0);
  });
});
