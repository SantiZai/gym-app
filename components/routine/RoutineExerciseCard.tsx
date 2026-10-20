"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Dumbbell, Plus, StickyNote, Trash2 } from "lucide-react";
import type { EditableExercise, EditableSerie } from "@/types/routine";
import { StepperInput } from "@/components/shared/StepperInput";
import { muscleName } from "@/lib/muscles";
import { equipmentLabel } from "@/lib/exerciseLabels";

const SERIE_TYPE_OPTIONS: { value: EditableSerie["type"]; label: string }[] = [
    { value: "warm-up", label: "Calentamiento" },
    { value: "normal", label: "Normal" },
    { value: "dropset", label: "Dropset" },
    { value: "otro", label: "Otro" },
];

const SERIE_TYPE_STYLES: Record<EditableSerie["type"], string> = {
    "warm-up": "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    normal: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
    dropset: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    otro: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
};

interface RoutineExerciseCardProps {
    exercise: EditableExercise;
    index: number;
    total: number;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemove: () => void;
    onAddSerie: () => void;
    onUpdateSerie: (serieId: string, patch: Partial<EditableSerie>) => void;
    onDuplicateSerie: (serieId: string) => void;
    onRemoveSerie: (serieId: string) => void;
    onNotesChange: (notes: string) => void;
}

export function RoutineExerciseCard({
    exercise,
    index,
    total,
    onMoveUp,
    onMoveDown,
    onRemove,
    onAddSerie,
    onUpdateSerie,
    onDuplicateSerie,
    onRemoveSerie,
    onNotesChange,
}: RoutineExerciseCardProps) {
    const [notesOpen, setNotesOpen] = useState(Boolean(exercise.notes));

    return (
        <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10">
            <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                        <h3 className="break-words text-base font-bold text-slate-900 dark:text-slate-100">
                            {exercise.name}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                <Dumbbell className="h-3 w-3 shrink-0" />
                                {muscleName(exercise.primary_muscle_id)}
                            </span>
                            {exercise.equipment && (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                    {equipmentLabel(exercise.equipment) ?? exercise.equipment}
                                </span>
                            )}
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                {exercise.series.length} {exercise.series.length === 1 ? "serie" : "series"}
                            </span>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                        <button
                            type="button"
                            onClick={onMoveUp}
                            disabled={index === 0}
                            aria-label={`Subir ${exercise.name}`}
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-white/10"
                        >
                            <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onMoveDown}
                            disabled={index === total - 1}
                            aria-label={`Bajar ${exercise.name}`}
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-white/10"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onRemove}
                            aria-label={`Eliminar ${exercise.name}`}
                            className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-white/5 dark:border-white/10">
                {exercise.series.length === 0 ? (
                    <p className="px-4 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                        Sin series todavía. Agregá una para empezar.
                    </p>
                ) : (
                    exercise.series.map((serie, serieIndex) => (
                        <div key={serie.id} className="px-3 py-3 sm:px-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                                        {serieIndex + 1}
                                    </span>
                                    <select
                                        value={serie.type}
                                        onChange={(event) =>
                                            onUpdateSerie(serie.id, { type: event.target.value as EditableSerie["type"] })
                                        }
                                        aria-label={`Tipo de la serie ${serieIndex + 1}`}
                                        className={`h-7 cursor-pointer rounded-full px-2.5 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${SERIE_TYPE_STYLES[serie.type]}`}
                                    >
                                        {SERIE_TYPE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => onDuplicateSerie(serie.id)}
                                        aria-label={`Duplicar serie ${serieIndex + 1}`}
                                        title="Duplicar serie"
                                        className="rounded-lg p-2 text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onRemoveSerie(serie.id)}
                                        disabled={exercise.series.length <= 1}
                                        aria-label={`Eliminar serie ${serieIndex + 1}`}
                                        title="Eliminar serie"
                                        className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-30 dark:hover:bg-red-950/40"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-2 flex items-center justify-center gap-5">
                                <div className="flex flex-col items-center gap-1">
                                    <StepperInput
                                        value={serie.weight}
                                        onChange={(value) => onUpdateSerie(serie.id, { weight: value })}
                                        step={2.5}
                                        inputMode="decimal"
                                        ariaLabel={`Peso serie ${serieIndex + 1}`}
                                        inputWidthClass="w-[72px]"
                                    />
                                    <span className="text-[11px] font-medium text-slate-400">kg</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <StepperInput
                                        value={serie.reps}
                                        onChange={(value) => onUpdateSerie(serie.id, { reps: value })}
                                        step={1}
                                        inputMode="numeric"
                                        ariaLabel={`Repeticiones serie ${serieIndex + 1}`}
                                        inputWidthClass="w-[72px]"
                                    />
                                    <span className="text-[11px] font-medium text-slate-400">reps</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="border-t border-slate-100 p-3 dark:border-white/10">
                <button
                    type="button"
                    onClick={onAddSerie}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-white/15 dark:text-blue-400 dark:hover:bg-blue-950/30"
                >
                    <Plus className="h-4 w-4" />
                    Agregar serie
                </button>

                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-white/10">
                    <button
                        type="button"
                        onClick={() => setNotesOpen((value) => !value)}
                        aria-expanded={notesOpen}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                        <StickyNote className="h-3.5 w-3.5" />
                        Notas del ejercicio
                        {exercise.notes ? <span className="text-blue-500">· escritas</span> : null}
                    </button>
                    {notesOpen && (
                        <textarea
                            value={exercise.notes ?? ""}
                            onChange={(event) => onNotesChange(event.target.value)}
                            rows={2}
                            placeholder="Técnica, descanso, recordatorios..."
                            className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                        />
                    )}
                </div>
            </div>
        </article>
    );
}
