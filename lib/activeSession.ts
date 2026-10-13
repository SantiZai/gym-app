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
