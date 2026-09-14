"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "cn";

export interface PlaceSelection {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
}

interface AddressAutocompleteProps {
  value: string;
  verified: boolean;
  onSelect: (place: PlaceSelection) => void;
  onTextChange: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  inputClassName?: string;
}

export function AddressAutocomplete({
  value,
  verified,
  onSelect,
  onTextChange,
  placeholder = "Av. Corrientes 1234, Buenos Aires",
  required,
  inputClassName,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    const q = value.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&accept-language=es&q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal, headers: { Accept: "application/json" } }
        );
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as NominatimResult[];
        setResults(data);
        setOpen(true);
        setHighlight(data.length > 0 ? 0 : -1);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  const pick = (r: NominatimResult) => {
    onSelect({
      address: r.display_name,
      latitude: Number.parseFloat(r.lat),
      longitude: Number.parseFloat(r.lon),
    });
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={value}
          onChange={(e) => {
            onTextChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => (h + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => (h - 1 + results.length) % results.length);
            } else if (e.key === "Enter" && highlight >= 0) {
              e.preventDefault();
              pick(results[highlight]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          maxLength={255}
          required={required}
          autoComplete="off"
          className={cn("h-11 pl-9", inputClassName)}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {verified ? (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Ubicación real verificada
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          Escribí al menos 3 letras y elegí una sugerencia del listado para validar la ubicación.
        </p>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {results.map((r, i) => (
            <li key={r.place_id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-2 text-left text-xs",
                  i === highlight ? "bg-blue-50" : "bg-white"
                )}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="line-clamp-2 text-slate-700">{r.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-slate-400">
        Búsqueda por ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">
          OpenStreetMap
        </a>
      </p>
    </div>
  );
}
