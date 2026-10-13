// Sesión en curso: permite salir de /sesion/[id] y volver a entrar sin
// perderla. Se guarda en localStorage al cargar la sesión y se limpia al
// finalizar/cancelar. El banner global (ActiveSessionBanner) la usa para
// ofrecer "Retomar".

export interface ActiveSession {
  sessionId: string;
  routineId: string | null;
  userId: string | null;
  startedAt: string | null;
  updatedAt: number;
}

const KEY = "habitus:active-session";

export function getActiveSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSession;
    if (!parsed?.sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setActiveSession(s: Omit<ActiveSession, "updatedAt">): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, updatedAt: Date.now() }));
  } catch {
    // sin almacenamiento: la sesión sigue viva en la DB
  }
}

export function clearActiveSession(sessionId?: string): void {
  try {
    if (!sessionId) {
      localStorage.removeItem(KEY);
      return;
    }
    const current = getActiveSession();
    if (current?.sessionId === sessionId) localStorage.removeItem(KEY);
  } catch {
    // ignorar
  }
}

// Resumen final: vive en memoria durante la sesión; se persiste para que
// un refresh en la pantalla de "¡Sesión completada!" no la pierda.
import type { SessionSummary } from "@/types/progress";

const summaryKeyFor = (sessionId: string) => `habitus:summary:${sessionId}`;

export function saveSessionSummary(sessionId: string, s: SessionSummary): void {
  try {
    localStorage.setItem(summaryKeyFor(sessionId), JSON.stringify(s));
  } catch {
    // ignorar
  }
}

export function getSessionSummary(sessionId: string): SessionSummary | null {
  try {
    const raw = localStorage.getItem(summaryKeyFor(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionSummary;
    if (typeof parsed?.totalSeriesCompleted !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}
