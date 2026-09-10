"use client";

interface TooltipItem {
  name?: unknown;
  value?: unknown;
  color?: string;
  payload?: Record<string, unknown>;
}

interface MinimalTooltipProps {
  active?: boolean;
  payload?: TooltipItem[];
  label?: unknown;
  /** Título superior (ej. fecha completa) */
  title?: string;
  /** Título dinámico a partir del primer item (tiene prioridad sobre title) */
  getTitle?: (item: TooltipItem) => string | null;
  /** Devuelve [valorVisible, etiqueta] por item */
  format?: (value: unknown, name: unknown, item: TooltipItem) => [string, string];
}

/** Tooltip minimalista oscuro, legible en ambos temas y táctil. */
export function MinimalTooltip({ active, payload, title, getTitle, format }: MinimalTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const heading = getTitle?.(payload[0]) ?? title ?? null;

  return (
    <div className="min-w-[140px] rounded-xl bg-slate-900 px-3 py-2 shadow-xl ring-1 ring-white/10">
      {heading ? <p className="mb-1 text-xs font-medium capitalize text-slate-300">{heading}</p> : null}
      <div className="space-y-0.5">
        {payload.map((item, i) => {
          const [value, name] = format
            ? format(item.value, item.name, item)
            : [String(item.value ?? "—"), String(item.name ?? "")];
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              {item.color ? (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: item.color }}
                />
              ) : null}
              {name ? <span className="text-slate-300">{name}</span> : null}
              <span className="ml-auto font-semibold text-white tabular-nums">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
