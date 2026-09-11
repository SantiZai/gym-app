import { ArrowUpRight, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

export const CAFECITO_URL = "https://cafecito.app/santizaidan";

/**
 * Botón compacto y poco intrusivo para la navbar (desktop).
 * Muestra solo el icono en pantallas md y agrega el texto desde lg.
 */
export function CafecitoNavbarButton({ className }: { className?: string }) {
  return (
    <a
      href={CAFECITO_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="¿Te gusta la app? Invitame un café"
      aria-label="¿Te gusta la app? Invitame un café"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 transition-colors duration-200 hover:bg-amber-100",
        className
      )}
    >
      <Coffee className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="hidden whitespace-nowrap lg:inline">Invitame un café</span>
    </a>
  );
}

/**
 * Tarjeta sutil para el menú lateral mobile, sobre la info del usuario.
 * Muestra la frase completa en dos líneas.
 */
export function CafecitoMenuCard({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <a
      href={CAFECITO_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      title="¿Te gusta la app? Invitame un café"
      aria-label="¿Te gusta la app? Invitame un café"
      className={cn(
        "flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 transition-colors duration-200 hover:bg-amber-100",
        className
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200/60">
        <Coffee className="h-4 w-4 text-amber-900" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] leading-tight text-amber-700">¿Te gusta la app?</span>
        <span className="block truncate text-sm font-semibold leading-tight text-amber-900">
          Invitame un café
        </span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
    </a>
  );
}
