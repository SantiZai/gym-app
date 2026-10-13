"use client";

import { useEffect } from "react";
import { toast } from "sonner";

// Registra el service worker (solo en producción para no cachear el dev)
// y avisa cuando hay una versión nueva lista para activar.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const notifyUpdate = (worker: ServiceWorker | null) => {
          if (!worker || cancelled) return;
          toast.info("Nueva versión disponible", {
            description: "Recargá para usar lo último de Habitus.",
            action: {
              label: "Recargar",
              onClick: () => window.location.reload(),
            },
            duration: 10000,
          });
        };
        // Ya hay una esperando (se instaló en otra pestaña)
        if (reg.waiting) notifyUpdate(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdate(worker);
            }
          });
        });
        // Cada vez que la app vuelve al frente, buscar updates
        const check = () => {
          if (document.visibilityState === "visible") void reg.update();
        };
        document.addEventListener("visibilitychange", check);
      } catch (error) {
        console.warn("No se pudo registrar el service worker:", error);
      }
    };
    void register();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
