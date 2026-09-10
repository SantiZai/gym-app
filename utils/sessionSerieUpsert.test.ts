import { describe, expect, it, vi } from "vitest";
import { updateOrCreateSessionSerie } from "./sessionUtils";

const mockState = vi.hoisted(() => ({ upserts: [] as unknown[][] }));

vi.mock("@/utils/supabase/client", () => ({
  createClient: vi.fn(async () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        in: () => chain,
        limit: () => Promise.resolve({ data: [], error: null }),
        upsert: (...args: unknown[]) => {
          mockState.upserts.push(args);
          return chain;
        },
        single: () => {
          const payload = mockState.upserts.at(-1)?.[0] as Record<string, unknown>;
          return Promise.resolve({ data: { id: "ss1", ...payload }, error: null });
        },
      };
      return chain;
    },
  })),
}));

describe("updateOrCreateSessionSerie", () => {
  it("usa un único upsert atómico con onConflict (sin find previo)", async () => {
    const row = await updateOrCreateSessionSerie("ses1", "ser1", "ex1", {
      weight_used: 60,
      reps_performed: 8,
    });

    expect(mockState.upserts).toHaveLength(1);
    const [payload, opts] = mockState.upserts[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(opts).toEqual({ onConflict: "session_id,serie_id" });
    expect(payload).toMatchObject({
      session_id: "ses1",
      serie_id: "ser1",
      exercise_id: "ex1",
      weight_used: 60,
      reps_performed: 8,
    });
    expect(payload).toHaveProperty("updated_at");
    expect(payload).not.toHaveProperty("created_at");
    expect(row.id).toBe("ss1");
  });
});
