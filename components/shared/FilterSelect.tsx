"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "__all";

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: string[];
  /** Etiqueta visible por valor (por defecto se muestra el valor crudo). */
  labels?: Record<string, string>;
  ariaLabel: string;
}

export function FilterSelect({ value, onChange, allLabel, options, labels, ariaLabel }: FilterSelectProps) {
  const normalizedValue = value === "" ? ALL_VALUE : value;

  const labelOf = (option: string) => labels?.[option] ?? option;

  // Base UI solo muestra el label del item si se le pasa `items`.
  // Sin esto, <SelectValue /> renderiza el valor crudo ("__all").
  const items = useMemo(
    () => [
      { label: allLabel, value: ALL_VALUE },
      ...options.map((option) => ({ label: labelOf(option), value: option })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allLabel, options, labels]
  );

  return (
    <Select
      value={normalizedValue}
      onValueChange={(v) => onChange(v === ALL_VALUE ? "" : (v as string))}
      items={items}
    >
      <SelectTrigger aria-label={ariaLabel} className="w-full">
        <SelectValue placeholder={allLabel}>
          {(v: string | null) => {
            if (!v || v === ALL_VALUE) return allLabel;
            return labelOf(v);
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {labelOf(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
