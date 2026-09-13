import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateOrCreateSessionSerie } from "./sessionUtils";

const mockState = vi.hoisted(() => ({
  updates: 0,
  inserts: 0,
  rpcCalls: 0,
  // "ok" | "missing": si el RPC save_session_serie_values existe en la DB
  rpcBehavior: "missing" as "ok" | "missing",
  // cola de respuestas para cada update().select(), en orden
  updateQueue: [] as Record<string, unknown>[][],
  // "ok" | "conflict": qué hace el insert
  insertBehavior: "ok" as "ok" | "conflict",
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: vi.fn(async () => ({
    rpc: () => {
      if (mockState.rpcBehavior === "missing") {
        return Promise.reject(new Error("function save_session_serie_values does not exist"));
      }
      mockState.rpcCalls += 1;
      return Promise.resolve({
        data: [{ id: "ss-rpc", session_id: "ses1", serie_id: "ser1", exercise_id: "ex1", completed: false }],
        error: null,
      });
    },
    from: () => {
      const state: { mode: null | "update" | "insert"; payload: unknown } = {
        mode: null,
        payload: null,
      };
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        in: () => chain,
        limit: () => Promise.resolve({ data: [], error: null }),
        update: (p: unknown) => {
          state.mode = "update";
          state.payload = p;
          mockState.updates += 1;
          return chain;
        },
        insert: (p: unknown) => {
          state.mode = "insert";
          state.payload = p;
          mockState.inserts += 1;
          return chain;
        },
        single: () => {
          if (state.mode === "insert" && mockState.insertBehavior === "conflict") {
            return Promise.resolve({ data: null, error: { code: "23505", message: "duplicate" } });
          }
          return Promise.resolve({
            data: { id: "ss1", ...(state.payload as Record<string, unknown>) },
            error: null,
          });
        },
        then: (resolve: (v: { data: Record<string, unknown>[]; error: null }) => void) => {
          resolve({ data: mockState.updateQueue.shift() ?? [], error: null });
        },
      };
      return chain;
    },
  })),
}));

beforeEach(() => {
  mockState.updates = 0;
  mockState.inserts = 0;
  mockState.rpcCalls = 0;
  mockState.rpcBehavior = "missing";
  mockState.updateQueue = [];
  mockState.insertBehavior = "ok";
});

describe("updateOrCreateSessionSerie", () => {
  it("actualiza si la fila existe (sin insertar)", async () => {
    mockState.updateQueue = [[{ id: "ss1", weight_used: 50 }]];

    const row = await updateOrCreateSessionSerie("ses1", "ser1", "ex1", { weight_used: 60 });

    expect(mockState.updates).toBe(1);
    expect(mockState.inserts).toBe(0);
    expect(row.id).toBe("ss1");
  });

  it("inserta si no existía", async () => {
    mockState.updateQueue = [[]];

    const row = await updateOrCreateSessionSerie("ses1", "ser1", "ex1", { weight_used: 60 });

    expect(mockState.updates).toBe(1);
    expect(mockState.inserts).toBe(1);
    expect(row.id).toBe("ss1");
  });

  it("ante 409 por carrera concurrente, reintenta el update en vez de fallar", async () => {
    // primer update: 0 filas → insert choca (409) → retry update: 1 fila
    mockState.updateQueue = [[], [{ id: "ss1" }]];
    mockState.insertBehavior = "conflict";

    const row = await updateOrCreateSessionSerie("ses1", "ser1", "ex1", { completed: true });

    expect(mockState.updates).toBe(2);
    expect(mockState.inserts).toBe(1);
    expect(row.id).toBe("ss1");
  });

  it("tipeo de peso/reps usa el RPC en 1 llamada (sin update ni insert)", async () => {
    mockState.rpcBehavior = "ok";

    const row = await updateOrCreateSessionSerie("ses1", "ser1", "ex1", { weight_used: 60, reps_performed: 10 });

    expect(mockState.rpcCalls).toBe(1);
    expect(mockState.updates).toBe(0);
    expect(mockState.inserts).toBe(0);
    expect(row.id).toBe("ss-rpc");
    expect(row.weight_used).toBe(60);
    expect(row.reps_performed).toBe(10);
    expect(row.completed).toBe(false);
  });

  it("si el RPC no existe en la DB, el tipeo cae al upsert legacy", async () => {
    mockState.rpcBehavior = "missing";
    mockState.updateQueue = [[{ id: "ss1", weight_used: 50 }]];

    const row = await updateOrCreateSessionSerie("ses1", "ser1", "ex1", { weight_used: 60 });

    expect(mockState.updates).toBe(1);
    expect(mockState.inserts).toBe(0);
    expect(row.id).toBe("ss1");
  });

  it("datos con completed no usan el RPC de valores (van al legacy)", async () => {
    mockState.rpcBehavior = "ok";
    mockState.updateQueue = [[{ id: "ss1" }]];

    await updateOrCreateSessionSerie("ses1", "ser1", "ex1", { weight_used: 60, completed: true });

    expect(mockState.rpcCalls).toBe(0);
    expect(mockState.updates).toBe(1);
  });
});
