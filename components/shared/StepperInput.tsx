"use client";

import { Minus, Plus } from "lucide-react";
import { stepValue } from "@/lib/stepper";

interface StepperInputProps {
  value: string;
  onChange: (value: string) => void;
  step?: number;
  min?: number;
  ariaLabel: string;
  inputMode?: "decimal" | "numeric";
  inputWidthClass?: string;
}

export function StepperInput({
  value,
  onChange,
  step = 1,
  min = 0,
  ariaLabel,
  inputMode = "numeric",
  inputWidthClass = "w-16",
}: StepperInputProps) {
  const btn =
    "flex h-10 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 active:bg-slate-300";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`${ariaLabel}: restar`}
        onClick={() => onChange(stepValue(value, step, -1, min))}
        className={btn}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <input
        type="number"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        min={min}
        step={step}
        className={`${inputWidthClass} h-10 rounded-lg border border-slate-200 bg-white px-1 py-2 text-center text-sm font-medium text-slate-900 shadow-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
      />
      <button
        type="button"
        aria-label={`${ariaLabel}: sumar`}
        onClick={() => onChange(stepValue(value, step, 1, min))}
        className={btn}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
