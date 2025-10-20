"use client";
import { useEffect, useRef, useState } from "react";

type SessionShape = {
  started_at?: string | null;
  status?: string | null;
};

export function useSessionTimer(session: SessionShape | null) {
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const intervalIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Cleanup previo por si acaso
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    // Validaciones básicas
    if (!session) {
      setElapsedTime(0);
      return;
    }
    if (session.status === "finished") {
      // si está finalizada, no corremos el timer
      return;
    }
    if (!session.started_at) {
      // si no hay started_at aún, esperamos
      setElapsedTime(0);
      return;
    }

    // Parsear fecha de inicio — usar Date.parse para chequear validez
    const parsed = Date.parse(session.started_at);
    if (!Number.isFinite(parsed)) {
      console.warn("useSessionTimer: session.started_at inválido:", session.started_at);
      setElapsedTime(0);
      return;
    }
    const startTime = parsed; // ms since epoch

    // Inicializar con tiempo ya transcurrido
    const initialElapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    setElapsedTime(initialElapsed);

    // Usar window.setInterval que devuelve number en browsers
    intervalIdRef.current = window.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - startTime) / 1000));
      setElapsedTime(elapsed);
    }, 1000);

    // Cleanup
    return () => {
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [session?.started_at, session?.status]);

  const formatElapsedTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  console.log(elapsedTime);

  return { elapsedTime, formatElapsedTime };
}
