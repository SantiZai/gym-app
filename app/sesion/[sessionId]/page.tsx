"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StepperInput } from "@/components/shared/StepperInput";
import {
    getSessionData,
    completeSessionSerie,
    finishSession,
    cancelSession,
    getLastPerformedByExerciseIds,
    updateOrCreateSessionSerie,
} from "@/utils/sessionUtils";
import { estimate1RM, getPersonalRecords } from "@/utils/progressUtils";
import type { RoutineExerciseWithDetails, Serie, Session, SessionSerie } from "@/types/db";
import type { SessionSummary } from "@/types/progress";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import {
    CheckCircle2,
    Circle,
    Timer,
    Dumbbell,
    AlertCircle,
    Trophy,
    X,
} from "lucide-react";
import { useSessionTimer } from "@/hooks/useSessionTimer";
import { useRestTimer } from "@/hooks/useRestTimer";

const DEFAULT_REST_SECONDS = 90;

export default function SessionPage() {
    const params = useParams();
    const router = useRouter();
    const sessionId = params?.sessionId as string;

    const [session, setSession] = useState<Session | null>(null);
    const [routineExercises, setRoutineExercises] = useState<RoutineExerciseWithDetails[]>(
        []
    );
    const [sessionSeries, setSessionSeries] = useState<SessionSerie[]>([]);
    const [loading, setLoading] = useState(true);
    const [finishing, setFinishing] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);
    const [summary, setSummary] = useState<SessionSummary | null>(null);

    const { elapsedTime, formatElapsedTime } = useSessionTimer(session);
    const {
        restTime,
        isRunning: resting,
        startRestTimer,
        stopRestTimer,
        formatRestTime,
    } = useRestTimer();

    // Estados para editar pesos y reps
    const [lastPerformedByExercise, setLastPerformedByExercise] = useState<Record<string, {
        weight_used: number | null;
        reps_performed: number | null;
        completed_at: string | null;
    }>>({});

    // Mejores marcas históricas (1RM est.) por ejercicio, para celebrar récords
    const [bestByExercise, setBestByExercise] = useState<Record<string, number>>({});

    // Estado para valores actuales de peso y reps por serie
    const [serieValues, setSerieValues] = useState<Record<string, {
        weight: string;
        reps: string;
    }>>({});

    // Refs para debouncing
    const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

    // Cargar datos de la sesión
    const loadSessionData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getSessionData(sessionId);

            // data should contain: session, routineExercises, sessionSeries
            const sessionObj = data.session;
            const routineExercisesArr = data.routineExercises || [];
            const sessionSeriesArr = data.sessionSeries || [];

            // Transform the data: Supabase returns exercise as an array sometimes, normalize to object
            const transformedRoutineExercises = routineExercisesArr.map((re: { exercise?: unknown } & Record<string, unknown>) => ({
                ...re,
                exercise: Array.isArray(re.exercise) ? re.exercise[0] : re.exercise
            })) as RoutineExerciseWithDetails[];

            // set base states
            setSession(sessionObj);
            setRoutineExercises(transformedRoutineExercises);
            setSessionSeries(sessionSeriesArr);

            // Inicializar valores de peso y reps para cada serie
            const initialValues: Record<string, { weight: string; reps: string }> = {};
            transformedRoutineExercises.forEach((re) => {
                re.series.forEach((serie) => {
                    const completedData = sessionSeriesArr.find(
                        (ss: SessionSerie) => ss.serie_id === serie.id && ss.completed
                    );
                    initialValues[serie.id] = {
                        weight: completedData?.weight_used != null
                            ? String(completedData.weight_used)
                            : serie.weight != null ? String(serie.weight) : "",
                        reps: completedData?.reps_performed != null
                            ? String(completedData.reps_performed)
                            : serie.reps != null ? String(serie.reps) : "",
                    };
                });
            });
            setSerieValues(initialValues);

            // Construir lista de exercise ids a consultar:
            const idsFromRoutine = transformedRoutineExercises
                .map((re) => re.exercise?.id)
                .filter(Boolean) as string[];

            const idsFromSeries = sessionSeriesArr
                .map((ss: SessionSerie) => ss.exercise_id)
                .filter(Boolean) as string[];

            const allIds = Array.from(new Set([...idsFromRoutine, ...idsFromSeries]));

            if (allIds.length > 0) {
                try {
                    const lastRows: { exercise_id: string | null; weight_used: number | null; reps_performed: number | null; completed_at: string | null }[] = await getLastPerformedByExerciseIds(allIds);
                    // lastRows puede ser [] o un array de filas con exercise_id, weight_used, reps_performed, completed_at
                    const mapLast: Record<string, {
                        weight_used: number | null;
                        reps_performed: number | null;
                        completed_at: string | null;
                    }> = {};

                    (lastRows || []).forEach((r) => {
                        if (!r || !r.exercise_id) return;
                        mapLast[r.exercise_id] = {
                            weight_used: r.weight_used ?? null,
                            reps_performed: r.reps_performed ?? null,
                            completed_at: r.completed_at ? String(r.completed_at) : null
                        };
                    });

                    setLastPerformedByExercise(mapLast);
                } catch (err) {
                    console.error("Error fetching last performed by exercises:", err);
                }
            } else {
                // limpiar si no hay ids
                setLastPerformedByExercise({});
            }

            // Mejores marcas históricas (incluye lo ya completado hoy;
            // la comparación exige superar estrictamente, así que sigue siendo correcta)
            try {
                const records = await getPersonalRecords(sessionObj.user_id);
                const bests: Record<string, number> = {};
                for (const r of records) bests[r.exerciseId] = r.bestE1rm;
                setBestByExercise(bests);
            } catch {
                setBestByExercise({});
            }

        } catch (error) {
            console.error("Error cargando sesión:", error);
            toast.error("Error al cargar la sesión");
            router.push("/rutinas");
        } finally {
            setLoading(false);
        }
    }, [sessionId, router]);

    useEffect(() => {
        if (sessionId) {
            loadSessionData();
        }
    }, [sessionId, loadSessionData]);

    // Verificar si una serie está completada
    const isSerieCompleted = (serieId: string) => {
        return sessionSeries.some(
            (ss) => ss.serie_id === serieId && ss.completed
        );
    };

    // Actualizar valores de serie en tiempo real con debouncing
    const updateSerieValueInDB = useCallback(async (
        serieId: string,
        exerciseId: string,
        weight: string,
        reps: string
    ) => {
        try {
            const weightNum = weight ? parseFloat(weight) : null;
            const repsNum = reps ? parseInt(reps) : null;

            await updateOrCreateSessionSerie(sessionId, serieId, exerciseId, {
                weight_used: weightNum,
                reps_performed: repsNum,
            });

            // Actualizar sessionSeries en el estado local sin recargar todo
            setSessionSeries(prev => {
                const existing = prev.find(ss => ss.serie_id === serieId);
                if (existing) {
                    return prev.map(ss =>
                        ss.serie_id === serieId
                            ? { ...ss, weight_used: weightNum, reps_performed: repsNum }
                            : ss
                    );
                } else {
                    return prev;
                }
            });
        } catch (error) {
            console.error("Error actualizando serie:", error);
        }
    }, [sessionId]);

    // Manejar cambio en inputs con debouncing
    const handleSerieValueChange = useCallback((
        serieId: string,
        exerciseId: string,
        field: 'weight' | 'reps',
        value: string
    ) => {
        // Cancelar timer anterior si existe
        if (debounceTimers.current[serieId]) {
            clearTimeout(debounceTimers.current[serieId]);
        }

        // Actualizar estado local inmediatamente y programar actualización en BD
        setSerieValues(prev => {
            const updatedValues = {
                ...prev,
                [serieId]: {
                    ...prev[serieId],
                    [field]: value,
                }
            };

            // Crear nuevo timer para actualizar en BD después de 500ms
            debounceTimers.current[serieId] = setTimeout(() => {
                const weight = field === 'weight' ? value : updatedValues[serieId].weight;
                const reps = field === 'reps' ? value : updatedValues[serieId].reps;
                updateSerieValueInDB(serieId, exerciseId, weight, reps);
            }, 500);

            return updatedValues;
        });
    }, [updateSerieValueInDB]);

    // Completar/descompletar serie
    // dentro de tu componente SessionPage (reemplazar la función existente)
    const handleCompleteSerie = useCallback(async (
        serie: Serie,
        exerciseId: string,
        completed: boolean
    ) => {
        try {
            // 1) cancelar cualquier timer pendiente para esta serie
            if (debounceTimers.current[serie.id]) {
                clearTimeout(debounceTimers.current[serie.id]);
                delete debounceTimers.current[serie.id];
            }

            // 2) leer los valores actuales desde el estado (no usar setState para leer)
            const current = serieValues[serie.id] || { weight: '', reps: '' };
            const weight = current.weight ? parseFloat(current.weight) : null;
            const reps = current.reps ? parseInt(current.reps) : null;

            // 3) llamar al backend y esperar la respuesta
            // completeSessionSerie debe devolver la fila creada/actualizada (ideal)
            const updatedSessionSerie = await completeSessionSerie(
                sessionId,
                serie.id,
                exerciseId,
                weight,
                reps,
                completed
            );

            // 4) actualizar el estado local usando el resultado del backend cuando sea posible
            setSessionSeries(prev => {
                const existing = prev.find(ss => ss.serie_id === serie.id);

                // Si el backend devolvió una fila, úsala (más fiable)
                if (updatedSessionSerie && updatedSessionSerie.id) {
                    if (existing) {
                        return prev.map(ss => ss.serie_id === serie.id
                            ? {
                                ...ss,
                                // mezclar valores devueltos por backend y valores locales
                                weight_used: updatedSessionSerie.weight_used ?? weight,
                                reps_performed: updatedSessionSerie.reps_performed ?? reps,
                                completed: typeof updatedSessionSerie.completed !== 'undefined' ? updatedSessionSerie.completed : completed,
                                completed_at: updatedSessionSerie.completed_at ?? (completed ? new Date().toISOString() : null),
                                updated_at: updatedSessionSerie.updated_at ?? new Date().toISOString(),
                            }
                            : ss
                        );
                    } else {
                        // agregar la fila devuelta por backend (mapeando campos para SessionSerie)
                        return [
                            ...prev,
                            {
                                id: updatedSessionSerie.id,
                                session_id: updatedSessionSerie.session_id ?? sessionId,
                                serie_id: serie.id,
                                exercise_id: exerciseId,
                                weight_used: updatedSessionSerie.weight_used ?? weight,
                                reps_performed: updatedSessionSerie.reps_performed ?? reps,
                                completed: typeof updatedSessionSerie.completed !== 'undefined' ? updatedSessionSerie.completed : completed,
                                completed_at: updatedSessionSerie.completed_at ?? (completed ? new Date().toISOString() : null),
                                started_at: updatedSessionSerie.started_at ?? null,
                                created_at: updatedSessionSerie.created_at ?? new Date().toISOString(),
                                updated_at: updatedSessionSerie.updated_at ?? new Date().toISOString(),
                            } as SessionSerie
                        ];
                    }
                }

                // Si backend NO devolvió fila (fallback), actualizamos con los valores que tenemos
                if (existing) {
                    return prev.map(ss => ss.serie_id === serie.id
                        ? {
                            ...ss,
                            weight_used: weight,
                            reps_performed: reps,
                            completed,
                            completed_at: completed ? new Date().toISOString() : null,
                            updated_at: new Date().toISOString(),
                        }
                        : ss
                    );
                } else {
                    return [
                        ...prev,
                        {
                            id: `local-${serie.id}-${Date.now()}`, // id temporal si backend no devolvió
                            session_id: sessionId,
                            serie_id: serie.id,
                            exercise_id: exerciseId,
                            weight_used: weight,
                            reps_performed: reps,
                            completed,
                            completed_at: completed ? new Date().toISOString() : null,
                            started_at: null,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        } as SessionSerie
                    ];
                }
            });

            // Celebrar récord en vivo al completar una serie que supera la mejor marca
            if (completed) {
                const e1rm = estimate1RM(weight, reps);
                const prevBest = bestByExercise[exerciseId];
                if (e1rm != null && prevBest != null && e1rm > prevBest) {
                    const exName =
                        routineExercises.find((re) => re.series.some((s) => s.id === serie.id))?.exercise.name ??
                        "Ejercicio";
                    toast.success(`¡Nuevo récord en ${exName}!`, {
                        description: `1RM estimado: ${e1rm} kg (antes ${prevBest} kg)`,
                        duration: 6000,
                        icon: <Trophy className="h-5 w-5 text-amber-500" />,
                    });
                    setBestByExercise((prev) => ({ ...prev, [exerciseId]: e1rm }));
                }
            }

            // Descanso automático al completar (se detiene al desmarcar)
            if (completed) {
                startRestTimer(DEFAULT_REST_SECONDS);
            } else {
                stopRestTimer();
            }

        } catch (error) {
            console.error("Error completando serie:", error);
            toast.error("Error al completar la serie");
        }
    }, [sessionId, serieValues, routineExercises, bestByExercise, startRestTimer, stopRestTimer]);


    // Limpiar timers al desmontar
    useEffect(() => {
        const timers = debounceTimers.current;
        return () => {
            Object.values(timers).forEach(timer => clearTimeout(timer));
        };
    }, []);

    // Calcular progreso
    const calculateProgress = () => {
        const totalSeries = routineExercises.reduce((acc, re) => acc + re.series.length, 0);
        const completedSeries = sessionSeries.filter((ss) => ss.completed).length;
        return totalSeries > 0 ? (completedSeries / totalSeries) * 100 : 0;
    };

    // Finalizar sesión y mostrar resumen
    const handleFinishSession = async () => {
        try {
            setFinishing(true);
            stopRestTimer();
            const result = await finishSession(sessionId);
            setSession((prev) => (prev ? { ...prev, status: "finished" } : prev));
            setSummary(result);
        } catch (error) {
            console.error("Error finalizando sesión:", error);
            toast.error("Error al finalizar la sesión");
        } finally {
            setFinishing(false);
        }
    };

    // Cancelar sesión (con confirmación previa)
    const handleCancelSession = async () => {
        try {
            setCancelling(true);
            stopRestTimer();
            await cancelSession(sessionId);
            router.push("/rutinas");
        } catch (error) {
            console.error("Error cancelando sesión:", error);
            toast.error("Error al cancelar la sesión");
        } finally {
            setCancelling(false);
            setConfirmandoCancelacion(false);
        }
    };

    const getSerieTypeLabel = (type: string) => {
        switch (type) {
            case "normal":
                return "Normal";
            case "warm-up":
                return "Calentamiento";
            case "dropset":
                return "Dropset";
            default:
                return "Otro";
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-slate-600">Cargando sesión...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                    <p className="mt-4 text-slate-600">Sesión no encontrada</p>
                </div>
            </div>
        );
    }

    if (summary) {
        const volumeLabel =
            summary.totalVolume >= 1000
                ? `${(summary.totalVolume / 1000).toFixed(1)} t`
                : `${summary.totalVolume} kg`;
        const stats = [
            { label: "Series", value: String(summary.totalSeriesCompleted) },
            { label: "Volumen", value: volumeLabel },
            { label: "Duración", value: summary.durationLabel },
        ];
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                        <Trophy className="h-8 w-8 text-amber-500" aria-hidden />
                    </div>
                    <h1 className="mt-4 text-2xl font-bold text-slate-900">
                        ¡Sesión completada!
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Buen trabajo, cada sesión suma.
                    </p>
                    <div className="mt-6 grid grid-cols-3 gap-3">
                        {stats.map((s) => (
                            <div key={s.label} className="rounded-xl bg-slate-50 p-3">
                                <p className="text-lg font-bold text-slate-900">{s.value}</p>
                                <p className="text-xs text-slate-500">{s.label}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 flex flex-col gap-2">
                        <Link
                            href="/progreso"
                            className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 text-center"
                        >
                            Ver mi progreso
                        </Link>
                        <Link
                            href="/rutinas"
                            className="w-full px-4 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors duration-200 text-center"
                        >
                            Volver a rutinas
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const progress = calculateProgress();
    const totalSeries = routineExercises.reduce((acc, re) => acc + re.series.length, 0);

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header fijo */}
            <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">
                                Sesión en progreso
                            </h1>
                            <p className="text-sm text-slate-500">
                                {routineExercises.length} ejercicios
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
                            <Timer className="h-5 w-5 text-blue-600" />
                            <span className="text-xl font-mono font-bold text-blue-600">
                                {formatElapsedTime(elapsedTime)}
                            </span>
                        </div>
                    </div>

                    {/* Barra de progreso */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Progreso</span>
                            <span className="font-semibold text-slate-900">
                                {sessionSeries.filter((ss) => ss.completed).length} /{" "}
                                {totalSeries}{" "}
                                series
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de ejercicios */}
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {routineExercises.map((routineExercise, idx) => {
                    const totalExerciseSeries = routineExercise.series.length;
                    const exerciseCompletedSeries = sessionSeries.filter((ss) =>
                        ss.exercise_id == routineExercise.exercise.id && ss.completed
                    ).length;
                    const exerciseProgress = totalExerciseSeries > 0
                        ? (exerciseCompletedSeries / totalExerciseSeries) * 100
                        : 0;

                    // obtener el "last performed" para este ejercicio (si existe)
                    const lastPerformed = lastPerformedByExercise[routineExercise.exercise.id];

                    return (
                        <div
                            key={routineExercise.id}
                            className="bg-white rounded-lg shadow-sm border overflow-hidden"
                        >
                            {/* Header del ejercicio */}
                            <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 border-b">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                                                {idx + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <h3 className="text-lg font-bold text-slate-900 break-words">
                                                    {routineExercise.exercise.name}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-slate-600">
                                                    {routineExercise.exercise.muscle && (
                                                        <span className="flex items-center gap-1">
                                                            <Dumbbell className="h-4 w-4 shrink-0" />
                                                            {routineExercise.exercise.muscle}
                                                        </span>
                                                    )}
                                                    {routineExercise.exercise.equipment && (
                                                        <span className="truncate">• {routineExercise.exercise.equipment}</span>
                                                    )}
                                                    {/* mostrar última vez en header si existe */}
                                                    {lastPerformed && (
                                                        <span className="w-full text-xs text-slate-500 sm:w-auto sm:ml-3 sm:mt-0">
                                                            Última: {lastPerformed.weight_used ?? "0"} kg × {lastPerformed.reps_performed ?? "0"} ({lastPerformed.completed_at ? new Date(lastPerformed.completed_at).toLocaleDateString() : "—"})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-sm font-semibold text-slate-900">
                                            {exerciseCompletedSeries} / {totalExerciseSeries}
                                        </span>
                                        <div className="w-20 bg-slate-200 rounded-full h-2 mt-1">
                                            <div
                                                className="bg-green-500 h-full rounded-full transition-all duration-300"
                                                style={{ width: `${exerciseProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Series */}
                            <div className="divide-y divide-slate-200">
                                {routineExercise.series.map((serie, serieIdx) => {
                                    const completed = isSerieCompleted(serie.id);

                                    // Obtener valores actuales del estado
                                    const currentValues = serieValues[serie.id] || { weight: '', reps: '' };

                                    return (
                                        <div
                                            key={serie.id}
                                            className={`px-4 py-3 transition-colors ${completed
                                                ? "bg-green-500/10"
                                                : "bg-white"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleCompleteSerie(
                                                                serie,
                                                                routineExercise.exercise.id,
                                                                !completed
                                                            );
                                                        }}
                                                        aria-pressed={completed}
                                                        aria-label={`${completed ? "Desmarcar" : "Completar"} serie ${serieIdx + 1}`}
                                                        className="-m-2 rounded-full p-2"
                                                    >
                                                        {completed ? (
                                                            <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                                                        ) : (
                                                            <Circle className="h-6 w-6 text-slate-300 flex-shrink-0" />
                                                        )}
                                                    </button>
                                                    <span className="font-semibold text-slate-700">
                                                        Serie {serieIdx + 1}
                                                    </span>
                                                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                                                        {getSerieTypeLabel(serie.type)}
                                                    </span>
                                                </div>
                                                {!completed && (serie.weight == null || serie.reps == null) && lastPerformed && (
                                                    <span className="shrink-0 text-xs text-slate-500">
                                                        Últ: {lastPerformed.weight_used ?? "—"} kg × {lastPerformed.reps_performed ?? "—"}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-3 flex items-center justify-center gap-5">
                                                <div className="flex items-center gap-2">
                                                    <StepperInput
                                                        value={currentValues.weight}
                                                        onChange={(v) => handleSerieValueChange(serie.id, routineExercise.exercise.id, 'weight', v)}
                                                        step={2.5}
                                                        inputMode="decimal"
                                                        ariaLabel={`Peso serie ${serieIdx + 1}`}
                                                        placeholder={serie.weight != null ? String(serie.weight) : (lastPerformed?.weight_used != null ? String(lastPerformed.weight_used) : "0")}
                                                        inputWidthClass="w-16"
                                                    />
                                                    <span className="text-sm text-slate-600">kg</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <StepperInput
                                                        value={currentValues.reps}
                                                        onChange={(v) => handleSerieValueChange(serie.id, routineExercise.exercise.id, 'reps', v)}
                                                        step={1}
                                                        inputMode="numeric"
                                                        ariaLabel={`Repeticiones serie ${serieIdx + 1}`}
                                                        placeholder={serie.reps != null ? String(serie.reps) : (lastPerformed?.reps_performed != null ? String(lastPerformed.reps_performed) : "0")}
                                                        inputWidthClass="w-16"
                                                    />
                                                    <span className="text-sm text-slate-600">reps</span>
                                                </div>
                                            </div>

                                            {/* Notas de la serie */}
                                            {serie.notes && (
                                                <p className="mt-2 text-center text-sm text-slate-600">
                                                    💡 {serie.notes}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pill de descanso */}
            {resting && !summary && (
                <div className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2">
                    <div className="flex items-center gap-2 rounded-full bg-slate-900 py-2 pl-4 pr-2 text-white shadow-lg">
                        <Timer className="h-4 w-4 text-blue-300" aria-hidden />
                        <span className="font-mono text-lg font-bold tabular-nums">
                            {formatRestTime(restTime)}
                        </span>
                        <span className="text-xs text-slate-300">descanso</span>
                        <button
                            onClick={() => startRestTimer(restTime + 30)}
                            className="rounded-full bg-slate-700 px-2.5 py-1 text-xs font-medium hover:bg-slate-600"
                        >
                            +30
                        </button>
                        <button
                            onClick={stopRestTimer}
                            aria-label="Saltar descanso"
                            className="rounded-full p-1.5 hover:bg-slate-700"
                        >
                            <X className="h-4 w-4" aria-hidden />
                        </button>
                    </div>
                </div>
            )}

            {/* Footer fijo con acciones */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
                <div className="max-w-4xl mx-auto px-4 py-4 flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => setConfirmandoCancelacion(true)}
                        disabled={cancelling || finishing}
                    >
                        {cancelling ? "Cancelando..." : "Cancelar Sesión"}
                    </Button>
                    <Button
                        className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold"
                        onClick={handleFinishSession}
                        disabled={finishing || cancelling}
                    >
                        {finishing ? "Finalizando..." : "Finalizar Sesión"}
                    </Button>
                </div>
            </div>
            <ConfirmDialog
                open={confirmandoCancelacion}
                title="Cancelar sesión"
                description="Se perderá todo el progreso de esta sesión. Esta acción no se puede deshacer."
                confirmLabel="Sí, cancelar"
                busy={cancelling}
                onConfirm={handleCancelSession}
                onCancel={() => setConfirmandoCancelacion(false)}
            />
        </div>
    );
}
