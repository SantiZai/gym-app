// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearActiveSession,
  getActiveSession,
  setActiveSession,
} from "./activeSession";
import {
  clearAllSerieDrafts,
  clearSerieDraft,
  getSerieDrafts,
  saveSerieDraft,
} from "./sessionDrafts";
import {
  clearOutboxForSession,
  enqueueOutbox,
  pendingOutboxCount,
} from "./sessionOutbox";

beforeEach(() => {
  localStorage.clear();
});

describe("activeSession", () => {
  it("guarda y recupera la sesión activa", () => {
    expect(getActiveSession()).toBeNull();
    setActiveSession({ sessionId: "s1", routineId: "r1", userId: "u1", startedAt: null });
    expect(getActiveSession()?.sessionId).toBe("s1");
  });

  it("solo limpia la sesión indicada", () => {
    setActiveSession({ sessionId: "s1", routineId: null, userId: null, startedAt: null });
    clearActiveSession("otra");
    expect(getActiveSession()?.sessionId).toBe("s1");
    clearActiveSession("s1");
    expect(getActiveSession()).toBeNull();
  });
});

describe("sessionDrafts", () => {
  it("guarda y restaura borradores por sesión", () => {
    saveSerieDraft("s1", "serie-1", "80", "10");
    expect(getSerieDrafts("s1")["serie-1"]).toMatchObject({ weight: "80", reps: "10" });
    expect(getSerieDrafts("otra")).toEqual({});
  });

  it("limpia borrador puntual y total", () => {
    saveSerieDraft("s1", "a", "1", "2");
    saveSerieDraft("s1", "b", "3", "4");
    clearSerieDraft("s1", "a");
    expect(getSerieDrafts("s1")["a"]).toBeUndefined();
    expect(getSerieDrafts("s1")["b"]).toBeDefined();
    clearAllSerieDrafts("s1");
    expect(getSerieDrafts("s1")).toEqual({});
  });
});

describe("sessionOutbox", () => {
  it("encola y cuenta pendientes por sesión", () => {
    enqueueOutbox({ kind: "serie-values", sessionId: "s1", serieId: "x", exerciseId: "e", weight: 80, reps: 10 });
    enqueueOutbox({ kind: "complete-serie", sessionId: "s1", serieId: "x", exerciseId: "e", weight: 80, reps: 10, completed: true });
    enqueueOutbox({ kind: "finish-session", sessionId: "s2" });
    expect(pendingOutboxCount()).toBe(3);
    expect(pendingOutboxCount("s1")).toBe(2);
    clearOutboxForSession("s1");
    expect(pendingOutboxCount()).toBe(1);
    expect(pendingOutboxCount("s1")).toBe(0);
  });
});
