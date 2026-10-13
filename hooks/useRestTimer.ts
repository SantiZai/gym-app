"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseRestTimerOptions {
  /** Si se pasa, el descanso sobrevive a recargas/navegación (clave por sesión). */
  storageKey?: string | null;
  /** Se llama una sola vez cuando el descanso termina. */
  onFinish?: () => void;
}

interface PersistedRest {
  endsAt: number;
  total: number;
}

function readPersisted(key: string): PersistedRest | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRest;
    if (!Number.isFinite(parsed.endsAt) || !Number.isFinite(parsed.total)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Descanso basado en timestamp absoluto (endsAt), no en decrementos.
// Así sigue corriendo aunque el navegador minimice la app, pause los
// intervals en background o se recargue la página (con storageKey).
export function useRestTimer(options: UseRestTimerOptions = {}) {
  const { storageKey = null, onFinish = null } = options;
  const [restTime, setRestTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const endsAtRef = useRef<number | null>(null);
  const intervalIdRef = useRef<number | null>(null);
  const onFinishRef = useRef<(() => void) | null>(null);
  onFinishRef.current = onFinish;

  const clearTick = useCallback(() => {
    if (intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  const persist = useCallback(
    (endsAt: number | null, total: number) => {
      if (!storageKey) return;
      try {
        if (endsAt == null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, JSON.stringify({ endsAt, total } satisfies PersistedRest));
      } catch {
        // almacenamiento no disponible: el timer sigue funcionando en memoria
      }
    },
    [storageKey]
  );

  // Recalcula el restante desde el timestamp. Devuelve true si terminó.
  const resync = useCallback(() => {
    if (endsAtRef.current == null) return false;
    const remaining = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
    setRestTime(remaining);
    if (remaining <= 0) {
      endsAtRef.current = null;
      clearTick();
      setIsRunning(false);
      persist(null, 0);
      onFinishRef.current?.();
      return true;
    }
    setIsRunning(true);
    return false;
  }, [clearTick, persist]);

  const startRestTimer = useCallback(
    (seconds: number = 90) => {
      const total = Math.max(0, Math.round(seconds));
      if (total <= 0) return;
      endsAtRef.current = Date.now() + total * 1000;
      persist(endsAtRef.current, total);
      setRestTime(total);
      setIsRunning(true);
      clearTick();
      intervalIdRef.current = window.setInterval(resync, 500);
    },
    [clearTick, persist, resync]
  );

  const stopRestTimer = useCallback(() => {
    endsAtRef.current = null;
    clearTick();
    persist(null, 0);
    setIsRunning(false);
    setRestTime(0);
  }, [clearTick, persist]);

  // Al montar: retomar un descanso persistido que siga vigente.
  // Al volver del background: recalcular al instante (los intervals
  // throtteados pueden tardar hasta un minuto en disparar).
  useEffect(() => {
    if (storageKey) {
      const saved = readPersisted(storageKey);
      if (saved && saved.endsAt > Date.now()) {
        endsAtRef.current = saved.endsAt;
        setRestTime(Math.ceil((saved.endsAt - Date.now()) / 1000));
        setIsRunning(true);
      } else if (saved) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          // ignorar
        }
      }
    }
    intervalIdRef.current = window.setInterval(resync, 500);

    const onVisible = () => {
      if (document.visibilityState === "visible") resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (intervalIdRef.current !== null) window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    };
    // Solo al montar: resync es estable y storageKey no cambia en la práctica.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatRestTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return { restTime, isRunning, startRestTimer, stopRestTimer, formatRestTime };
}
