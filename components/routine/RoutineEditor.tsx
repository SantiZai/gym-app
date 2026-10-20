"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Dumbbell, Loader2, Plus, Save } from "lucide-react";
import type { Exercise } from "@/types/db";
import type { EditableExercise, EditableRoutine, EditableSerie } from "@/types/routine";
import { buildRoutinePayload, createDefaultSeries, isTempId, tempId } from "@/lib/routineEditor";
import { saveRoutineFull } from "@/utils/routineUtils";
import { ExercisePicker } from "@/components/routine/ExercisePicker";
import { RoutineExerciseCard } from "@/components/routine/RoutineExerciseCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";

interface RoutineEditorProps {
    mode: "create" | "edit";
    routineId?: string;
    initialRoutine?: EditableRoutine;
}

const inputClass =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 md:text-sm";

export function RoutineEditor({ mode, routineId, initialRoutine }: RoutineEditorProps) {
    const router = useRouter();
    const [name, setName] = useState(initialRoutine?.name ?? "");
    const [description, setDescription] = useState(initialRoutine?.description ?? "");
    const [isPublic, setIsPublic] = useState(initialRoutine?.public ?? false);
    const [exercises, setExercises] = useState<EditableExercise[]>(initialRoutine?.exercises ?? []);
    const [detailsOpen, setDetailsOpen] = useState(mode === "create" || !initialRoutine?.name);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [exerciseToRemove, setExerciseToRemove] = useState<number | null>(null);

    const initialRoutineExerciseIdsRef = useRef<string[]>(
        (initialRoutine?.exercises ?? [])
            .map((exercise) => exercise.routine_exercise_id)
            .filter((id): id is string => Boolean(id))
    );
    const initialSerieIdsRef = useRef<string[]>(
        (initialRoutine?.exercises ?? []).flatMap((exercise) =>
            exercise.series.map((serie) => serie.id).filter((id) => !isTempId(id))
        )
    );

    const selectedIds = useMemo(
        () => new Set(exercises.map((exercise) => exercise.exercise_id)),
        [exercises]
    );
    const totalSeries = useMemo(
        () => exercises.reduce((total, exercise) => total + exercise.series.length, 0),
        [exercises]
    );

    const closePicker = useCallback(() => setPickerOpen(false), []);

    const updateExercise = (exerciseId: string, updater: (exercise: EditableExercise) => EditableExercise) => {
        setExercises((previous) =>
            previous.map((exercise) => (exercise.exercise_id === exerciseId ? updater(exercise) : exercise))
        );
    };

    const handleToggleExercise = (exercise: Exercise) => {
        setExercises((previous) => {
            const alreadyAdded = previous.some((item) => item.exercise_id === exercise.id);
            if (alreadyAdded) {
                return previous
                    .filter((item) => item.exercise_id !== exercise.id)
                    .map((item, index) => ({ ...item, orden: index + 1 }));
            }

            const newExercise: EditableExercise = {
                exercise_id: exercise.id,
                name: exercise.name,
                primary_muscle_id: exercise.primary_muscle_id,
                secondary_muscle_ids: exercise.secondary_muscle_ids ?? [],
                type: exercise.type,
                equipment: exercise.equipment,
                instructions: exercise.instructions,
                routine_exercise_id: null,
                orden: previous.length + 1,
                notes: null,
                series: createDefaultSeries(3),
            };

            return [...previous, newExercise];
        });
    };

    const handleAddSerie = (exerciseId: string) => {
        updateExercise(exerciseId, (exercise) => {
            const last = exercise.series[exercise.series.length - 1];
            const serie: EditableSerie = {
                id: tempId(),
                type: last?.type ?? "normal",
                reps: last?.reps ?? "10",
                weight: last?.weight ?? "0",
                orden: exercise.series.length + 1,
                notes: null,
            };
            return { ...exercise, series: [...exercise.series, serie] };
        });
    };

    const handleUpdateSerie = (exerciseId: string, serieId: string, patch: Partial<EditableSerie>) => {
        updateExercise(exerciseId, (exercise) => ({
            ...exercise,
            series: exercise.series.map((serie) => (serie.id === serieId ? { ...serie, ...patch } : serie)),
        }));
    };

    const handleDuplicateSerie = (exerciseId: string, serieId: string) => {
        updateExercise(exerciseId, (exercise) => {
            const index = exercise.series.findIndex((serie) => serie.id === serieId);
            if (index === -1) return exercise;

            const copy: EditableSerie = { ...exercise.series[index], id: tempId() };
            const series = [...exercise.series];
            series.splice(index + 1, 0, copy);

            return {
                ...exercise,
                series: series.map((serie, serieIndex) => ({ ...serie, orden: serieIndex + 1 })),
            };
        });
    };

    const handleRemoveSerie = (exerciseId: string, serieId: string) => {
        updateExercise(exerciseId, (exercise) => {
            if (exercise.series.length <= 1) return exercise;
            return {
                ...exercise,
                series: exercise.series
                    .filter((serie) => serie.id !== serieId)
                    .map((serie, index) => ({ ...serie, orden: index + 1 })),
            };
        });
    };

    const handleNotesChange = (exerciseId: string, notes: string) => {
        updateExercise(exerciseId, (exercise) => ({ ...exercise, notes }));
    };

    const handleMoveExercise = (index: number, direction: "up" | "down") => {
        setExercises((previous) => {
            const targetIndex = direction === "up" ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= previous.length) return previous;

            const next = [...previous];
            [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

            return next.map((exercise, exerciseIndex) => ({ ...exercise, orden: exerciseIndex + 1 }));
        });
    };

    const confirmRemoveExercise = () => {
        if (exerciseToRemove === null) return;
        setExercises((previous) =>
            previous
                .filter((_, index) => index !== exerciseToRemove)
                .map((exercise, index) => ({ ...exercise, orden: index + 1 }))
        );
        setExerciseToRemove(null);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setDetailsOpen(true);
            toast.warning("Ponele un nombre a la rutina");
            return;
        }

        if (exercises.length === 0) {
            toast.warning("Agregá al menos un ejercicio");
            return;
        }

        const withoutSeries = exercises.find((exercise) => exercise.series.length === 0);
        if (withoutSeries) {
            toast.warning(`Agregá al menos una serie a ${withoutSeries.name}`);
            return;
        }

        setSaving(true);
        try {
            const payload = buildRoutinePayload({
                id: routineId ?? null,
                name,
                description,
                public: isPublic,
                exercises,
            });

            const currentRoutineExerciseIds = new Set(
                exercises
                    .map((exercise) => exercise.routine_exercise_id)
                    .filter((id): id is string => Boolean(id))
            );
            const removedRoutineExerciseIds = initialRoutineExerciseIdsRef.current.filter(
                (id) => !currentRoutineExerciseIds.has(id)
            );

            const currentSerieIds = new Set(exercises.flatMap((exercise) => exercise.series.map((serie) => serie.id)));
            const removedSerieIds = initialSerieIdsRef.current.filter((id) => !currentSerieIds.has(id));

            await saveRoutineFull({
                routineId: mode === "edit" ? routineId ?? null : null,
                payload,
                removedRoutineExerciseIds,
                removedSerieIds,
            });

            toast.success(mode === "create" ? "Rutina creada" : "Cambios guardados");
            router.push("/rutinas");
        } catch (error) {
            console.error("Error guardando rutina:", error);
            toast.error(error instanceof Error ? error.message : "No se pudo guardar la rutina. Probá de nuevo.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-32 dark:bg-slate-950">
            <header
                className="sticky z-20 border-b border-slate-200/70 bg-white/95 backdrop-blur transition-[top] duration-300 dark:border-white/10 dark:bg-slate-950/90"
                style={{ top: "var(--nav-top, calc(4rem + env(safe-area-inset-top)))" }}
            >
                <div className="mx-auto max-w-4xl px-4 pb-3 pt-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <Link
                                href="/rutinas"
                                aria-label="Volver a rutinas"
                                className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                            <div className="min-w-0">
                                <h1 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
                                    {mode === "create" ? "Nueva rutina" : name || "Editar rutina"}
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {exercises.length} {exercises.length === 1 ? "ejercicio" : "ejercicios"} · {totalSeries} {totalSeries === 1 ? "serie" : "series"}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={saving}
                            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-green-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50 sm:px-4"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            <span className="hidden sm:inline">{saving ? "Guardando..." : mode === "create" ? "Crear rutina" : "Guardar cambios"}</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-4xl space-y-4 px-4 py-5">
                <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10">
                    <button
                        type="button"
                        onClick={() => setDetailsOpen((value) => !value)}
                        aria-expanded={detailsOpen}
                        className="flex w-full items-center justify-between gap-3"
                    >
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Detalles de la rutina</span>
                        <ChevronDown
                            className={`h-4 w-4 text-slate-400 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
                        />
                    </button>

                    {!detailsOpen && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {name || "Sin nombre"} · {isPublic ? "Pública" : "Privada"}
                        </p>
                    )}

                    {detailsOpen && (
                        <div className="mt-4 space-y-3">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    Nombre *
                                </span>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    placeholder="Ej: Push A — Pecho y tríceps"
                                    maxLength={80}
                                    className={inputClass}
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    Descripción <span className="font-normal text-slate-400">(opcional)</span>
                                </span>
                                <textarea
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                    placeholder="Para quién es, nivel, objetivo..."
                                    maxLength={500}
                                    rows={2}
                                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 md:text-sm"
                                />
                            </label>

                            <label className="flex items-center gap-2.5">
                                <input
                                    type="checkbox"
                                    checked={isPublic}
                                    onChange={(event) => setIsPublic(event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">Hacer rutina pública</span>
                            </label>
                        </div>
                    )}
                </section>

                <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ejercicios</h2>
                    {exercises.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setPickerOpen(true)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar
                        </button>
                    )}
                </div>

                {exercises.length === 0 ? (
                    <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/50">
                            <Dumbbell className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">Empezá tu rutina</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Elegí ejercicios y definí series, peso y repeticiones.
                        </p>
                        <button
                            type="button"
                            onClick={() => setPickerOpen(true)}
                            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4" />
                            Elegir ejercicios
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {exercises.map((exercise, index) => (
                            <RoutineExerciseCard
                                key={exercise.exercise_id}
                                exercise={exercise}
                                index={index}
                                total={exercises.length}
                                onMoveUp={() => handleMoveExercise(index, "up")}
                                onMoveDown={() => handleMoveExercise(index, "down")}
                                onRemove={() => setExerciseToRemove(index)}
                                onAddSerie={() => handleAddSerie(exercise.exercise_id)}
                                onUpdateSerie={(serieId, patch) =>
                                    handleUpdateSerie(exercise.exercise_id, serieId, patch)
                                }
                                onDuplicateSerie={(serieId) => handleDuplicateSerie(exercise.exercise_id, serieId)}
                                onRemoveSerie={(serieId) => handleRemoveSerie(exercise.exercise_id, serieId)}
                                onNotesChange={(notes) => handleNotesChange(exercise.exercise_id, notes)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/70 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur dark:border-white/10 dark:bg-slate-950/90">
                <div className="mx-auto flex max-w-4xl gap-2.5 px-4 py-3">
                    <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
                    >
                        <Plus className="h-4 w-4" />
                        Agregar ejercicio
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </footer>

            <ExercisePicker
                open={pickerOpen}
                onClose={closePicker}
                selectedIds={selectedIds}
                onToggle={handleToggleExercise}
            />

            <ConfirmDialog
                open={exerciseToRemove !== null}
                title="Eliminar ejercicio"
                description="Se eliminará el ejercicio y todas sus series de la rutina."
                confirmLabel="Eliminar"
                onConfirm={confirmRemoveExercise}
                onCancel={() => setExerciseToRemove(null)}
            />
        </div>
    );
}
