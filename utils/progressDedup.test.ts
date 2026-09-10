import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTrainingDays, getWeeklyStreak } from "./progressUtils";

const mockState = vi.hoisted(() => ({ sessions: 0, series: 0 }));

vi.mock("@/utils/supabase/client", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        in: () => chain,
        limit: () => {
          if (table === "sessions") mockState.sessions += 1;
          if (table === "session_series") mockState.series += 1;
          return Promise.resolve({ data: [], error: null });
        },
      };
      return chain;
    },
  })),
}));

beforeEach(() => {
  mockState.sessions = 0;
  mockState.series = 0;
});

describe("dedup de peticiones concurrentes", () => {
  it("comparate las sesiones en una sola petición", async () => {
    const [days, streak] = await Promise.all([
      getTrainingDays("u1", "all"),
      getWeeklyStreak("u1"),
    ]);
    expect(days).toEqual([]);
    expect(streak.current).toBe(0);
    expect(mockState.sessions).toBe(1);
    expect(mockState.series).toBe(0);
  });

  it("peticiones secuenciales sí vuelven a pedir (sin caché rancia)", async () => {
    await getTrainingDays("u1", "all");
    await getTrainingDays("u1", "all");
    expect(mockState.sessions).toBe(2);
  });
});
