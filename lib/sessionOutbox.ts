// Cola offline para la sesión: cuando no hay conexión, completar series,
// editar valores y finalizar se encolan en localStorage y se reintentan
// en orden al volver la red (evento online + al enfocar la app).
// La UI es optimista: pinta al instante y sincroniza en background.

import {
  completeSessionSerie,
  finishSession,
  updateOrCreateSessionSerie,
} from "@/utils/sessionUtils";
import type { SessionSummary } from "@/types/progress";

export type OutboxOp =
  | {
      kind: "serie-values";
      sessionId: string;
      serieId: string;
      exerciseId: string;
      weight: number | null;
      reps: number | null;
    }
  | {
      kind: "complete-serie";
      sessionId: string;
      serieId: string;
      exerciseId: string;
      weight: number | null;
      reps: number | null;
      completed: boolean;
    }
  | { kind: "finish-session"; sessionId: string };

export interface OutboxEntry {
  id: string;
  ts: number;
  op: OutboxOp;
}

const KEY = "habitus:outbox";

function readQueue(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OutboxEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: OutboxEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // ignorar
  }
}

export function enqueueOutbox(op: OutboxOp): OutboxEntry {
  const entry: OutboxEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    op,
  };
  const q = readQueue();
  q.push(entry);
  writeQueue(q);
  return entry;
}

export function pendingOutboxCount(sessionId?: string): number {
  const q = readQueue();
  return sessionId ? q.filter((e) => e.op.sessionId === sessionId).length : q.length;
}

/** Descarta todo lo encolado de una sesión (ej. al cancelarla en la DB). */
export function clearOutboxForSession(sessionId: string): void {
  writeQueue(readQueue().filter((e) => e.op.sessionId !== sessionId));
}

function removeEntries(ids: Set<string>): void {
  writeQueue(readQueue().filter((e) => !ids.has(e.id)));
}

/** Compacta la cola: para la misma serie, valores viejos los pisa el complete posterior. */
function compactQueue(queue: OutboxEntry[]): OutboxEntry[] {
  const lastCompleteBySerie = new Map<string, number>();
  queue.forEach((e, i) => {
    if (e.op.kind === "complete-serie") lastCompleteBySerie.set(`${e.op.sessionId}:${e.op.serieId}`, i);
  });
  return queue.filter((e, i) => {
    if (e.op.kind !== "serie-values") return true;
    const lastComplete = lastCompleteBySerie.get(`${e.op.sessionId}:${e.op.serieId}`);
    return lastComplete == null || lastComplete < i;
  });
}

export interface FlushResult {
  flushed: number;
  failed: number;
  /** Resumen si se finalizó una sesión durante el flush. */
  finishSummaries: { sessionId: string; summary: SessionSummary }[];
}

/** Reproduce la cola en orden por sesión. Lo que falle queda encolado. */
export async function flushOutbox(): Promise<FlushResult> {
  const queue = compactQueue(readQueue());
  const done = new Set<string>();
  const finishSummaries: { sessionId: string; summary: SessionSummary }[] = [];
  let failed = 0;

  // Orden por sesión (dentro de cada sesión se respeta el orden de llegada;
  // una sesión trabada no bloquea a las demás).
  const groups = new Map<string, OutboxEntry[]>();
  for (const entry of queue) {
    const list = groups.get(entry.op.sessionId) ?? [];
    list.push(entry);
    groups.set(entry.op.sessionId, list);
  }

  const runOp = async (op: OutboxOp): Promise<SessionSummary | null> => {
    if (op.kind === "serie-values") {
      await updateOrCreateSessionSerie(op.sessionId, op.serieId, op.exerciseId, {
        weight_used: op.weight,
        reps_performed: op.reps,
      });
      return null;
    }
    if (op.kind === "complete-serie") {
      await completeSessionSerie(
        op.sessionId,
        op.serieId,
        op.exerciseId,
        op.weight,
        op.reps,
        op.completed
      );
      return null;
    }
    return finishSession(op.sessionId);
  };

  for (const [, entries] of groups) {
    for (const entry of entries) {
      try {
        const summary = await runOp(entry.op);
        if (summary) finishSummaries.push({ sessionId: entry.op.sessionId, summary });
        done.add(entry.id);
      } catch {
        // Se frena esta sesión para preservar el orden; el resto queda.
        failed += entries.length - entries.filter((e) => done.has(e.id)).length;
        break;
      }
    }
  }

  if (done.size > 0) removeEntries(done);
  return { flushed: done.size, failed, finishSummaries };
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
