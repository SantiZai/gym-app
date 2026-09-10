"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

/** CTAs del home según sesión (el middleware igual protege las rutas). */
export function HomeCTA() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col sm:flex-row gap-4 justify-center" aria-hidden>
        <div className="px-8 py-3 rounded-lg bg-slate-200 animate-pulse">
          <span className="invisible font-medium">Comenzar ahora</span>
        </div>
        <div className="px-8 py-3 rounded-lg bg-slate-200 animate-pulse">
          <span className="invisible font-medium">Ver mi progreso</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <Link
        href={user ? "/rutinas" : "/login"}
        className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl text-center"
      >
        Comenzar ahora
      </Link>
      <Link
        href={user ? "/progreso" : "/login"}
        className="px-8 py-3 bg-white text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors duration-200 border-2 border-slate-200 text-center"
      >
        Ver mi progreso
      </Link>
    </div>
  );
}
