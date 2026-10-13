"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { clearActiveSession, getActiveSession, type ActiveSession } from "@/lib/activeSession";
import { getSessionById } from "@/utils/sessionUtils";

// Banner global: si hay una sesión en curso y no estás en ella,
// ofrece retomarla con un toque. Verifica en la DB que siga abierta.
export function ActiveSessionBanner() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [active, setActive] = useState<ActiveSession | null>(null);

  const verify = useCallback(async () => {
    const stored = getActiveSession();
    if (!stored) {
      setActive(null);
      return;
    }
    if (user && stored.userId && stored.userId !== user.id) {
      setActive(null);
      return;
    }
    if (!navigator.onLine) {
      // Sin red no se puede verificar: mostrar igual para retomar.
      setActive(stored);
      return;
    }
    try {
      const session = await getSessionById(stored.sessionId);
      if (session?.status === "in_progress") setActive(stored);
      else {
        clearActiveSession(stored.sessionId);
        setActive(null);
      }
    } catch {
      // Ante la duda no molestar: si la página de sesión la abre, ella revalida.
      setActive(stored);
    }
  }, [user]);

  useEffect(() => {
    void verify();
  }, [verify, pathname]);

  if (!active) return null;
  if (pathname?.startsWith(`/sesion/${active.sessionId}`)) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <Link
        href={`/sesion/${active.sessionId}`}
        className="flex items-center gap-3 rounded-2xl bg-slate-900 py-3 pl-4 pr-3 text-white shadow-xl"
      >
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Sesión en curso</span>
          <span className="block truncate text-xs text-slate-300">Tocá para retomar donde quedaste</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold">
          <PlayCircle className="h-4 w-4" aria-hidden />
          Retomar
        </span>
      </Link>
    </div>
  );
}
