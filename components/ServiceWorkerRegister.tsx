"use client";

import { useEffect } from "react";

// Registra el service worker (solo en producción para no cachear el dev).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.warn("No se pudo registrar el service worker:", error);
      }
    };
    void register();
  }, []);
  return null;
}
