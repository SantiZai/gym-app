"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "habitus:install-dismissed";

// Pastilla "Instalar app" cuando el navegador lo permite y aún no está instalada.
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // ignorar
    }
    if (stored) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    setDismissed(false);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (dismissed || !deferred) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignorar
    }
  };

  const install = async () => {
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      // ignorar
    }
    setDeferred(null);
    dismiss();
  };

  return (
    <div className="fixed bottom-20 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-2 shadow-xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100">
          <Download className="h-5 w-5 text-blue-700" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">Instalar Habitus</span>
          <span className="block truncate text-xs text-slate-500">Acceso directo y funciona sin conexión</span>
        </span>
        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Instalar
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Descartar"
          className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
