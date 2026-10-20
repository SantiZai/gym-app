"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Check, Dumbbell, Loader2, Plus, Search, X } from "lucide-react";
import type { Exercise } from "@/types/db";
import { getExercisesCached } from "@/utils/exercisesUtils";
import { MUSCLES, muscleName } from "@/lib/muscles";
import { equipmentLabel } from "@/lib/exerciseLabels";
import { FilterSelect } from "@/components/shared/FilterSelect";

const PAGE_SIZE = 60;

interface ExercisePickerProps {
    open: boolean;
    onClose: () => void;
    selectedIds: Set<string>;
    onToggle: (exercise: Exercise) => void;
}

export function ExercisePicker({ open, onClose, selectedIds, onToggle }: ExercisePickerProps) {
    const [allExercises, setAllExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [search, setSearch] = useState("");
    const [filterMuscle, setFilterMuscle] = useState("");
    const [filterType, setFilterType] = useState("");
    const [filterEquipment, setFilterEquipment] = useState("");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const loadedRef = useRef(false);
    const deferredSearch = useDeferredValue(search);

    const loadExercises = useCallback(async (force = false) => {
        setLoading(true);
        setFailed(false);
        try {
            const data = await getExercisesCached(force);
            setAllExercises(data);
            if (data.length === 0) setFailed(true);
        } catch (error) {
            console.error("Error cargando ejercicios:", error);
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open || loadedRef.current) return;
        loadedRef.current = true;
        void loadExercises();
    }, [open, loadExercises]);

    useEffect(() => {
        if (!open) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleKey);
        };
    }, [open, onClose]);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [deferredSearch, filterMuscle, filterType, filterEquipment]);

    const musculos = useMemo(
        () => MUSCLES.filter((muscle) => allExercises.some((exercise) => exercise.primary_muscle_id === muscle.slug)).map((muscle) => muscle.slug),
        [allExercises]
    );
    const musculoLabels = useMemo(
        () => Object.fromEntries(MUSCLES.map((muscle) => [muscle.slug, `${muscle.name} · ${muscle.region}`])),
        []
    );
    const tipos = useMemo(
        () => [...new Set(allExercises.map((exercise) => exercise.type).filter((value): value is string => !!value))],
        [allExercises]
    );
    const equipamientos = useMemo(
        () => [...new Set(allExercises.map((exercise) => exercise.equipment).filter((value): value is string => !!value))],
        [allExercises]
    );

    const filteredExercises = useMemo(() => {
        const lower = deferredSearch.trim().toLowerCase();
        return allExercises.filter((exercise) => {
            const matchesSearch =
                !lower ||
                exercise.name.toLowerCase().includes(lower) ||
                muscleName(exercise.primary_muscle_id).toLowerCase().includes(lower) ||
                (exercise.instructions ?? "").toLowerCase().includes(lower);
            const matchesMuscle = !filterMuscle || exercise.primary_muscle_id === filterMuscle;
            const matchesType = !filterType || exercise.type === filterType;
            const matchesEquipment = !filterEquipment || exercise.equipment === filterEquipment;
            return matchesSearch && matchesMuscle && matchesType && matchesEquipment;
        });
    }, [allExercises, deferredSearch, filterMuscle, filterType, filterEquipment]);

    if (!open) return null;

    const visibleExercises = filteredExercises.slice(0, visibleCount);
    const hasMore = filteredExercises.length > visibleCount;

    return (
        <div className="fixed inset-0 z-[70]">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Elegir ejercicios"
                className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-950 sm:bottom-auto sm:top-1/2 sm:max-h-[88dvh] sm:-translate-y-1/2 sm:rounded-3xl"
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 pb-3 pt-4 dark:border-white/10">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Elegir ejercicios</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {selectedIds.size} {selectedIds.size === 1 ? "seleccionado" : "seleccionados"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar selector de ejercicios"
                        className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="shrink-0 space-y-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar por nombre o músculo..."
                            aria-label="Buscar ejercicios"
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-base text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 md:text-sm"
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <FilterSelect
                            value={filterMuscle}
                            onChange={setFilterMuscle}
                            allLabel="Todos los músculos"
                            options={musculos}
                            labels={musculoLabels}
                            ariaLabel="Filtrar por músculo"
                        />
                        <FilterSelect
                            value={filterType}
                            onChange={setFilterType}
                            allLabel="Todos los tipos"
                            options={tipos}
                            ariaLabel="Filtrar por tipo de ejercicio"
                        />
                        <FilterSelect
                            value={filterEquipment}
                            onChange={setFilterEquipment}
                            allLabel="Todo el equipamiento"
                            options={equipamientos}
                            ariaLabel="Filtrar por equipamiento"
                        />
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        </div>
                    ) : failed ? (
                        <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
                            <p className="text-sm text-slate-500">No se pudieron cargar los ejercicios.</p>
                            <button
                                type="button"
                                onClick={() => void loadExercises(true)}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : filteredExercises.length === 0 ? (
                        <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                            <Dumbbell className="h-8 w-8 text-slate-300" />
                            <p className="text-sm text-slate-500">No se encontraron ejercicios.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {visibleExercises.map((exercise) => {
                                const selected = selectedIds.has(exercise.id);
                                return (
                                    <button
                                        key={exercise.id}
                                        type="button"
                                        onClick={() => onToggle(exercise)}
                                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selected
                                            ? "border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/30"
                                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-white/5"
                                            }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                {exercise.name}
                                            </p>
                                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                {muscleName(exercise.primary_muscle_id)} · {equipmentLabel(exercise.equipment) ?? "—"}
                                            </p>
                                        </div>
                                        <span
                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${selected
                                                ? "bg-blue-600 text-white"
                                                : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"
                                                }`}
                                        >
                                            {selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                        </span>
                                    </button>
                                );
                            })}
                            {hasMore && (
                                <button
                                    type="button"
                                    onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                                    className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
                                >
                                    Mostrar más
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-slate-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-white/10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-11 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                        Listo · {selectedIds.size} {selectedIds.size === 1 ? "ejercicio" : "ejercicios"}
                    </button>
                </div>
            </div>
        </div>
    );
}
