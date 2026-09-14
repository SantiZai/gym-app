import { ArrowUpRight, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

export const CAFECITO_URL = "https://cafecito.app/santizaidan";

/**
 * Fila para el dropdown del usuario (desktop): va sobre "Información personal".
 * Estilo de item de menú con acento ámbar.
 */
export function CafecitoDropdownItem({ onClick }: { onClick?: () => void }) {
  return (
    <a
      href={CAFECITO_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      title="¿Te gusta la app? Invitame un café"
      aria-label="¿Te gusta la app? Invitame un café"
      className="flex items-center space-x-3 px-4 py-3 transition-colors duration-200 hover:bg-amber-50 dark:hover:bg-amber-950/30"
    >
      <Coffee className="h-4 w-4 text-amber-700 dark:text-amber-200/70" aria-hidden />
      <span className="text-sm font-medium text-amber-900 dark:text-amber-100/80">Invitame un café</span>
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
        "flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 transition-colors duration-200 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:hover:bg-amber-900/30",
        className
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200/60 dark:bg-amber-900/50">
        <Coffee className="h-4 w-4 text-amber-900 dark:text-amber-200/70" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] leading-tight text-amber-700 dark:text-amber-200/50">¿Te gusta la app?</span>
        <span className="block truncate text-sm font-semibold leading-tight text-amber-900 dark:text-amber-100/75">
          Invitame un café
        </span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-200/50" aria-hidden />
    </a>
  );
}
