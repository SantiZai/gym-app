"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  flushOutbox,
  isOnline,
  pendingOutboxCount,
  type FlushResult,
} from "@/lib/sessionOutbox";

interface UseOnlineSyncOptions {
  /** Sesión visible (para contar pendientes propios). */
  sessionId?: string | null;
  /** Se llama cuando un flush trae novedades (ej. finish encolado que se concretó). */
  onFlushed?: (result: FlushResult) => void;
}

// Sincroniza la cola offline al volver la red o la app al frente.
// Expone estado de conexión y cantidad de cambios pendientes.
export function useOnlineSync(options: UseOnlineSyncOptions = {}) {
  const { sessionId = null, onFlushed = null } = options;
  const [online, setOnline] = useState<boolean>(() => isOnline());
  const [pending, setPending] = useState<number>(0);
  const flushingRef = useRef(false);
  const onFlushedRef = useRef(onFlushed);
  onFlushedRef.current = onFlushed;

  const refresh = useCallback(() => {
    setPending(pendingOutboxCount(sessionId ?? undefined));
  }, [sessionId]);

  const syncNow = useCallback(async () => {
    if (flushingRef.current || !isOnline()) {
      refresh();
      return;
    }
    flushingRef.current = true;
    try {
      const result = await flushOutbox();
      if (result.flushed > 0 || result.finishSummaries.length > 0) {
        onFlushedRef.current?.(result);
      }
    } catch {
      // el próximo evento lo reintenta
    } finally {
      flushingRef.current = false;
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    const goOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const goOffline = () => {
      setOnline(false);
      refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setOnline(isOnline());
        void syncNow();
      }
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, syncNow]);

  return { online, pending, refresh, syncNow };
}
