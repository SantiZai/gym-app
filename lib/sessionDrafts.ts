// Borradores de peso/reps tipeados pero aún no guardados en la DB.
// Respaldo en localStorage: si se sale de la página antes del debounce
// (500ms) o se mata el proceso, al volver se restauran. La DB siempre
// tiene prioridad cuando ya tiene valor.

export interface SerieDraft {
  weight: string;
  reps: string;
  at: number;
}

const keyFor = (sessionId: string) => `habitus:drafts:${sessionId}`;

function readAll(sessionId: string): Record<string, SerieDraft> {
  try {
    const raw = localStorage.getItem(keyFor(sessionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SerieDraft>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSerieDraft(sessionId: string, serieId: string, weight: string, reps: string): void {
  try {
    const all = readAll(sessionId);
    all[serieId] = { weight, reps, at: Date.now() };
    localStorage.setItem(keyFor(sessionId), JSON.stringify(all));
  } catch {
    // ignorar
  }
}

export function getSerieDrafts(sessionId: string): Record<string, SerieDraft> {
  return readAll(sessionId);
}

export function clearSerieDraft(sessionId: string, serieId: string): void {
  try {
    const all = readAll(sessionId);
    if (all[serieId]) {
      delete all[serieId];
      localStorage.setItem(keyFor(sessionId), JSON.stringify(all));
    }
  } catch {
    // ignorar
  }
}

export function clearAllSerieDrafts(sessionId: string): void {
  try {
    localStorage.removeItem(keyFor(sessionId));
  } catch {
    // ignorar
  }
}
