"use client";

import { Minus, Plus } from "lucide-react";
import { stepValue } from "@/lib/stepper";

interface StepperInputProps {
  value: string;
  onChange: (value: string) => void;
  step?: number;
  min?: number;
  ariaLabel: string;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
  inputWidthClass?: string;
}

/** Stepper vertical: [+] arriba, valor al medio, [−] abajo, un solo bloque. */
export function StepperInput({
  value,
  onChange,
  step = 1,
  min = 0,
  ariaLabel,
  placeholder,
  inputMode = "numeric",
  inputWidthClass = "w-16",
}: StepperInputProps) {
  const btn =
    "flex h-8 w-full items-center justify-center bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 active:bg-slate-200";

  return (
    <div
      className={`flex flex-col divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${inputWidthClass}`}
    >
      <button
        type="button"
        aria-label={`${ariaLabel}: sumar`}
        onClick={() => onChange(stepValue(value, step, 1, min))}
        className={btn}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
      <input
        type="number"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        placeholder={placeholder}
        min={min}
        step={step}
        className="h-11 w-full border-0 bg-transparent px-1 text-center text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      />
      <button
        type="button"
        aria-label={`${ariaLabel}: restar`}
        onClick={() => onChange(stepValue(value, step, -1, min))}
        className={btn}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
