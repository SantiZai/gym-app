"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200">
          <WifiOff className="h-8 w-8 text-slate-500" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Sin conexión</h1>
        <p className="mt-2 text-sm text-slate-600">
          No hay internet ahora mismo. Tus sesiones guardadas se sincronizan solas cuando vuelva la red.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
