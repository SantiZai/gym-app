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

/** Stepper vertical: [+] arriba, valor al medio, [−] abajo, un solo bloque integrado. */
export function StepperInput({
  value,
  onChange,
  step = 1,
  min = 0,
  ariaLabel,
  placeholder,
  inputMode = "numeric",
  inputWidthClass = "w-20",
}: StepperInputProps) {
  const btn =
    "flex h-8 w-full items-center justify-center bg-transparent text-slate-500 transition-colors hover:bg-slate-100/70 active:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-white/10 dark:active:bg-white/15";

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900 ${inputWidthClass}`}
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
        className="h-11 w-full border-0 bg-transparent px-1 text-center text-sm font-semibold tabular-nums text-slate-900 placeholder-slate-400 [appearance:textfield] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:text-slate-100 dark:placeholder-slate-500 [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
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
