"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
import { updateSerie } from "@/utils/routineUtils";
import { muscleName } from "@/lib/muscles";
import { equipmentLabel } from "@/lib/exerciseLabels";
import { estimate1RM, getPersonalRecords, invalidateProgressDataset } from "@/utils/progressUtils";
import { clearActiveSession, getSessionSummary, saveSessionSummary, setActiveSession } from "@/lib/activeSession";
import {
    clearAllSerieDrafts,
    clearSerieDraft,
    getSerieDrafts,
    saveSerieDraft,
} from "@/lib/sessionDrafts";
import {
    clearOutboxForSession,
    enqueueOutbox,
    isOnline,
    type FlushResult,
} from "@/lib/sessionOutbox";
import { useOnlineSync } from "@/hooks/useOnlineSync";
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
    const [loadOffline, setLoadOffline] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);
    const [summary, setSummary] = useState<SessionSummary | null>(() =>
        sessionId ? getSessionSummary(sessionId) : null
    );

    const { elapsedTime, formatElapsedTime } = useSessionTimer(session);
    const handleRestFinished = useCallback(() => {
        try {
            navigator.vibrate?.(200);
        } catch {
            // vibración no disponible
        }
        toast.success("Descanso terminado", { description: "A darle a la próxima serie." });
    }, []);
    const {
        restTime,
        isRunning: resting,
        startRestTimer,
        stopRestTimer,
        formatRestTime,
    } = useRestTimer({
        storageKey: sessionId ? `habitus:rest:${sessionId}` : null,
        onFinish: handleRestFinished,
    });

    // Sincronización offline: al volver la red se reproducen los cambios
    // encolados. Si se había pedido finalizar sin conexión, acá llega el resumen.
    const handleFlushed = useCallback((result: FlushResult) => {
        const mine = result.finishSummaries.find((f) => f.sessionId === sessionId);
        if (mine) {
            clearActiveSession(sessionId);
            clearAllSerieDrafts(sessionId);
            saveSessionSummary(sessionId, mine.summary);
            setSession((prev) => (prev ? { ...prev, status: "finished" } : prev));
            setSummary(mine.summary);
            toast.success("Sesión sincronizada y finalizada");
        }
    }, [sessionId]);
    const { online, pending, refresh: refreshPending } = useOnlineSync({
        sessionId,
        onFlushed: handleFlushed,
    });

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

    // Refs para debouncing y para callbacks estables (evitan recrear
    // handleCompleteSerie en cada keystroke y lecturas stale)
    const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
    const serieValuesRef = useRef<Record<string, { weight: string; reps: string }>>({});
    const sessionSeriesRef = useRef<SessionSerie[]>([]);
    const bestByExerciseRef = useRef<Record<string, number>>({});
    const routineExercisesRef = useRef<RoutineExerciseWithDetails[]>([]);
    serieValuesRef.current = serieValues;
    sessionSeriesRef.current = sessionSeries;
    bestByExerciseRef.current = bestByExercise;
    routineExercisesRef.current = routineExercises;

    // Lookup O(1) de completadas + progreso memoizado (antes: .some/.filter
    // por cada serie en cada render → lag con muchas series)
    const completedSet = useMemo(
        () => new Set(sessionSeries.filter((ss) => ss.completed).map((ss) => ss.serie_id)),
        [sessionSeries]
    );
    const { totalSeries, completedCount, progress } = useMemo(() => {
        const total = routineExercises.reduce((acc, re) => acc + re.series.length, 0);
        return { totalSeries: total, completedCount: completedSet.size, progress: total > 0 ? (completedSet.size / total) * 100 : 0 };
    }, [routineExercises, completedSet]);

    // Cargar datos de la sesión: primero lo crítico (pintar), después lo
    // secundario (últimos pesos + récords) sin bloquear el spinner.
    // Antes: 4-5 roundtrips secuenciales (sesión → rutina → series →
    // lastPerformed → getPersonalRecords con TODO el historial) antes de pintar.
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

            // Si ya estaba finalizada (refresh en el resumen), no hay nada que retomar
            if (sessionObj.status === "finished") {
                clearActiveSession(sessionId);
                const stored = getSessionSummary(sessionId);
                if (stored) setSummary(stored);
                setLoading(false);
                return;
            }

            // Registrar como sesión activa (retomar al salir y volver)
            setActiveSession({
                sessionId,
                routineId: sessionObj.routine_id ?? null,
                userId: sessionObj.user_id ?? null,
                startedAt: sessionObj.started_at ?? null,
            });

            // Inicializar valores de peso y reps para cada serie.
            // La DB manda; si no hay nada guardado y hay borrador local
            // (tipeo previo a salir), se restaura para no perderlo.
            const drafts = getSerieDrafts(sessionId);
            const initialValues: Record<string, { weight: string; reps: string }> = {};
            transformedRoutineExercises.forEach((re) => {
                re.series.forEach((serie) => {
                    const completedData = sessionSeriesArr.find(
                        (ss: SessionSerie) => ss.serie_id === serie.id && ss.completed
                    );
                    if (completedData?.weight_used != null || completedData?.reps_performed != null) {
                        // Hay dato real: el borrador quedó obsoleto
                        clearSerieDraft(sessionId, serie.id);
                    }
                    const draft = drafts[serie.id];
                    const hasDraft = draft != null && (draft.weight !== "" || draft.reps !== "");
                    initialValues[serie.id] = {
                        weight: completedData?.weight_used != null
                            ? String(completedData.weight_used)
                            : hasDraft ? draft.weight : (serie.weight != null ? String(serie.weight) : ""),
                        reps: completedData?.reps_performed != null
                            ? String(completedData.reps_performed)
                            : hasDraft ? draft.reps : (serie.reps != null ? String(serie.reps) : ""),
                    };
                });
            });
            setSerieValues(initialValues);
            // Pintar ya: lo crítico está listo. Lo secundario carga en
            // background sin retener el spinner.
            setLoading(false);

            // Secundario en background: últimos pesos + mejores marcas.
            // No se awaita en el flujo crítico; cada uno actualiza su estado al llegar.
            void (async () => {
                const idsFromRoutine = transformedRoutineExercises
                    .map((re) => re.exercise?.id)
                    .filter(Boolean) as string[];
                const idsFromSeries = sessionSeriesArr
                    .map((ss: SessionSerie) => ss.exercise_id)
                    .filter(Boolean) as string[];
                const allIds = Array.from(new Set([...idsFromRoutine, ...idsFromSeries]));

                type LastRow = { exercise_id: string | null; weight_used: number | null; reps_performed: number | null; completed_at: string | null };
                const [lastRes, recordsRes] = await Promise.allSettled([
                    (allIds.length > 0
                        ? getLastPerformedByExerciseIds(allIds)
                        : Promise.resolve([] as LastRow[])) as Promise<LastRow[]>,
                    getPersonalRecords(sessionObj.user_id),
                ]);

                if (lastRes.status === "fulfilled") {
                    const mapLast: Record<string, {
                        weight_used: number | null;
                        reps_performed: number | null;
                        completed_at: string | null;
                    }> = {};
                    (lastRes.value || []).forEach((r: LastRow) => {
                        if (!r || !r.exercise_id) return;
                        mapLast[r.exercise_id] = {
                            weight_used: r.weight_used ?? null,
                            reps_performed: r.reps_performed ?? null,
                            completed_at: r.completed_at ? String(r.completed_at) : null
                        };
                    });
                    setLastPerformedByExercise(mapLast);
                } else {
                    console.error("Error fetching last performed by exercises:", lastRes.reason);
                }

                if (recordsRes.status === "fulfilled") {
                    const bests: Record<string, number> = {};
                    for (const r of recordsRes.value) bests[r.exerciseId] = r.bestE1rm;
                    setBestByExercise(bests);
                } else {
                    setBestByExercise({});
                }
            })();

        } catch (error) {
            console.error("Error cargando sesión:", error);
            if (!isOnline()) {
                // Sin red no se puede traer la sesión: esperar en pantalla
                // con reintento en vez de expulsar a /rutinas.
                setLoadOffline(true);
            } else {
                toast.error("Error al cargar la sesión");
                router.push("/rutinas");
            }
        } finally {
            setLoading(false);
        }
    }, [sessionId, router]);

    useEffect(() => {
        if (sessionId) {
            loadSessionData();
        }
    }, [sessionId, loadSessionData]);

    // Verificar si una serie está completada (O(1) vía Set memoizado)
    const isSerieCompleted = useCallback((serieId: string) => {
        return completedSet.has(serieId);
    }, [completedSet]);

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
            clearSerieDraft(sessionId, serieId);

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
            if (!isOnline()) {
                // Sin conexión: queda el valor en pantalla + borrador y se encola
                enqueueOutbox({
                    kind: "serie-values",
                    sessionId,
                    serieId,
                    exerciseId,
                    weight: weight ? parseFloat(weight) : null,
                    reps: reps ? parseInt(reps) : null,
                });
                refreshPending();
                toast.info("Sin conexión: el cambio se sincronizará solo");
            }
        }
    }, [sessionId, refreshPending]);

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

            // Respaldo inmediato: si se sale antes del debounce no se pierde
            saveSerieDraft(sessionId, serieId, updatedValues[serieId].weight, updatedValues[serieId].reps);

            // Crear nuevo timer para actualizar en BD después de 500ms
            debounceTimers.current[serieId] = setTimeout(() => {
                const weight = field === 'weight' ? value : updatedValues[serieId].weight;
                const reps = field === 'reps' ? value : updatedValues[serieId].reps;
                updateSerieValueInDB(serieId, exerciseId, weight, reps);
            }, 500);

            return updatedValues;
        });
    }, [updateSerieValueInDB, sessionId]);

    // Completar/descompletar serie con UI OPTIMISTA: pinta al instante y
    // sincroniza en background con 1 RPC. Antes esperaba 1-2 roundtrips
    // secuenciales antes de actualizar el estado → cada tap tardaba.
    const handleCompleteSerie = useCallback(async (
        serie: Serie,
        exerciseId: string,
        completed: boolean
    ) => {
        // 1) cancelar cualquier timer pendiente para esta serie
        if (debounceTimers.current[serie.id]) {
            clearTimeout(debounceTimers.current[serie.id]);
            delete debounceTimers.current[serie.id];
        }

        // 2) leer los valores actuales vía ref (callback estable, sin stale closure)
        const current = serieValuesRef.current[serie.id] || { weight: '', reps: '' };
        const weight = current.weight ? parseFloat(current.weight) : null;
        const reps = current.reps ? parseInt(current.reps) : null;
        const now = new Date().toISOString();
        const prevEntry = sessionSeriesRef.current.find(ss => ss.serie_id === serie.id);

        // 3) update optimista inmediato (la UI responde sin esperar red)
        const optimisticEntry = {
            id: prevEntry?.id ?? `local-${serie.id}`,
            session_id: sessionId,
            serie_id: serie.id,
            exercise_id: exerciseId,
            weight_used: weight,
            reps_performed: reps,
            completed,
            completed_at: completed ? now : null,
            started_at: prevEntry?.started_at ?? null,
            created_at: prevEntry?.created_at ?? now,
            updated_at: now,
            metadata: prevEntry?.metadata ?? null,
        } as SessionSerie;
        setSessionSeries(prev => {
            const existing = prev.find(ss => ss.serie_id === serie.id);
            if (existing) {
                return prev.map(ss => ss.serie_id === serie.id ? optimisticEntry : ss);
            }
            return [...prev, optimisticEntry];
        });

        // 4) feedback inmediato: descanso + posible récord
        if (completed) {
            startRestTimer(DEFAULT_REST_SECONDS);
            const e1rm = estimate1RM(weight, reps);
            const prevBest = bestByExerciseRef.current[exerciseId];
            if (e1rm != null && prevBest != null && e1rm > prevBest) {
                const exName =
                    routineExercisesRef.current.find((re) => re.series.some((s) => s.id === serie.id))?.exercise.name ??
                    "Ejercicio";
                toast.success(`¡Nuevo récord en ${exName}!`, {
                    description: `1RM estimado: ${e1rm} kg (antes ${prevBest} kg)`,
                    duration: 6000,
                    icon: <Trophy className="h-5 w-5 text-amber-500" />,
                });
                setBestByExercise((prev) => ({ ...prev, [exerciseId]: e1rm }));
            }
        } else {
            stopRestTimer();
        }

        // 5) sincronizar en background (1 RPC atómico); rollback si falla
        try {
            const updatedSessionSerie = await completeSessionSerie(
                sessionId,
                serie.id,
                exerciseId,
                weight,
                reps,
                completed
            );
            clearSerieDraft(sessionId, serie.id);

            // Reconciliar id real del backend (por si era fila nueva optimista)
            if (updatedSessionSerie && updatedSessionSerie.id) {
                setSessionSeries(prev => prev.map(ss => ss.serie_id === serie.id
                    ? {
                        ...ss,
                        id: updatedSessionSerie.id,
                        weight_used: updatedSessionSerie.weight_used ?? weight,
                        reps_performed: updatedSessionSerie.reps_performed ?? reps,
                        completed: typeof updatedSessionSerie.completed !== 'undefined' ? updatedSessionSerie.completed : completed,
                        completed_at: updatedSessionSerie.completed_at ?? (completed ? now : null),
                        updated_at: updatedSessionSerie.updated_at ?? now,
                    }
                    : ss
                ));
            }
        } catch (error) {
            console.error("Error completando serie:", error);
            if (!isOnline()) {
                // Sin conexión: se conserva el estado optimista y se encola
                enqueueOutbox({
                    kind: "complete-serie",
                    sessionId,
                    serieId: serie.id,
                    exerciseId,
                    weight,
                    reps,
                    completed,
                });
                refreshPending();
                toast.info("Sin conexión: la serie se sincronizará sola");
                return;
            }
            // Rollback al estado previo
            setSessionSeries(prev => {
                if (!prevEntry) return prev.filter(ss => ss.serie_id !== serie.id);
                return prev.map(ss => ss.serie_id === serie.id ? prevEntry : ss);
            });
            toast.error("Error al completar la serie");
        }
    }, [sessionId, startRestTimer, stopRestTimer, refreshPending]);


    // Limpiar timers al desmontar
    useEffect(() => {
        const timers = debounceTimers.current;
        return () => {
            Object.values(timers).forEach(timer => clearTimeout(timer));
        };
    }, []);

    // Al ocultar la app (minimizar, cambiar de app, bloquear pantalla),
    // forzar el guardado de lo tipeado pendiente: el debounce de 500ms
    // no llegaría a disparar y ese cambio "se borraría de la nada".
    useEffect(() => {
        const flushPending = () => {
            const pendingIds = Object.keys(debounceTimers.current);
            if (pendingIds.length === 0) return;
            const values = serieValuesRef.current;
            const exercises = routineExercisesRef.current;
            for (const serieId of pendingIds) {
                const timer = debounceTimers.current[serieId];
                if (timer) clearTimeout(timer);
                delete debounceTimers.current[serieId];
                const v = values[serieId];
                if (!v) continue;
                const owner = exercises.find((re) => re.series.some((s) => s.id === serieId));
                if (!owner) continue;
                void updateSerieValueInDB(serieId, owner.exercise.id, v.weight, v.reps);
            }
        };
        const onHidden = () => {
            if (document.visibilityState === "hidden") flushPending();
        };
        document.addEventListener("visibilitychange", onHidden);
        window.addEventListener("pagehide", flushPending);
        return () => {
            document.removeEventListener("visibilitychange", onHidden);
            window.removeEventListener("pagehide", flushPending);
        };
    }, [updateSerieValueInDB]);

    // Finalizar sesión y mostrar resumen
    const handleFinishSession = async () => {
        try {
            setFinishing(true);
            stopRestTimer();
            const result = await finishSession(sessionId);
            clearActiveSession(sessionId);
            clearAllSerieDrafts(sessionId);
            clearOutboxForSession(sessionId);
            saveSessionSummary(sessionId, result);
            if (session?.user_id) invalidateProgressDataset(session.user_id);
            setSession((prev) => (prev ? { ...prev, status: "finished" } : prev));
            setSummary(result);
        } catch (error) {
            console.error("Error finalizando sesión:", error);
            if (!isOnline()) {
                enqueueOutbox({ kind: "finish-session", sessionId });
                refreshPending();
                toast.info("Sin conexión: la sesión se finalizará sola al volver la red");
            } else {
                toast.error("Error al finalizar la sesión");
            }
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
            clearActiveSession(sessionId);
            clearAllSerieDrafts(sessionId);
            clearOutboxForSession(sessionId);
            if (session?.user_id) invalidateProgressDataset(session.user_id);
            router.push("/rutinas");
        } catch (error) {
            console.error("Error cancelando sesión:", error);
            toast.error("Error al cancelar la sesión");
        } finally {
            setCancelling(false);
            setConfirmandoCancelacion(false);
        }
    };

    const getSerieTypeClass = (type: string) => {
        switch (type) {
            case "warm-up":
                return "bg-yellow-100 text-yellow-800";
            case "dropset":
            case "otro":
                return "bg-slate-200 text-slate-700";
            default:
                return "bg-blue-100 text-blue-700";
        }
    };

    // Cambiar el tipo de la serie planificada en medio de la sesión
    // (persiste en la rutina, igual que los ajustes de peso/reps al finalizar)
    const handleSerieTypeChange = async (
        routineExerciseId: string,
        serieId: string,
        type: Serie["type"]
    ) => {
        setRoutineExercises((prev) =>
            prev.map((re) =>
                re.id === routineExerciseId
                    ? { ...re, series: re.series.map((s) => (s.id === serieId ? { ...s, type } : s)) }
                    : re
            )
        );
        try {
            await updateSerie(serieId, { type });
        } catch (error) {
            console.error("Error cambiando tipo de serie:", error);
            toast.error("No se pudo cambiar el tipo de serie");
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
        if (loadOffline) {
            return (
                <div className="flex items-center justify-center min-h-screen px-4">
                    <div className="text-center max-w-sm">
                        <p className="text-4xl" aria-hidden>📶</p>
                        <h1 className="mt-4 text-xl font-bold text-slate-900">Sin conexión</h1>
                        <p className="mt-2 text-sm text-slate-600">
                            No pudimos cargar tu sesión. Tus cambios guardados están a salvo y se sincronizarán solos.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setLoadOffline(false);
                                loadSessionData();
                            }}
                            className="mt-6 w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Reintentar
                        </button>
                    </div>
                </div>
            );
        }
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

    if (session.status === "finished") {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                        <Trophy className="h-8 w-8 text-green-600" aria-hidden />
                    </div>
                    <h1 className="mt-4 text-2xl font-bold text-slate-900">
                        Sesión finalizada
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Esta sesión ya está cerrada. El detalle vive en tu progreso.
                    </p>
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

    return (
        <div className="min-h-screen bg-slate-50 pb-20 overscroll-none">
            {/* Header fijo: sigue a la nav móvil (var --nav-top) para no quedar tapado */}
            <div
                className="bg-white border-b sticky z-10 shadow-sm transition-[top] duration-300"
                style={{ top: "var(--nav-top, 4rem)" }}
            >
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
                        <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg dark:bg-blue-950/50">
                                <Timer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                <span className="text-xl font-mono font-bold text-blue-600 dark:text-blue-300">
                                    {formatElapsedTime(elapsedTime)}
                                </span>
                            </div>
                            {!online && (
                                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                                    Sin conexión{pending > 0 ? ` · ${pending} por sincronizar` : " · se guarda local"}
                                </span>
                            )}
                            {online && pending > 0 && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                    Sincronizando {pending}…
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Barra de progreso */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Progreso</span>
                            <span className="font-semibold text-slate-900">
                                {completedCount} /{" "}
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
                    const exerciseCompletedSeries = routineExercise.series.filter((s) =>
                        completedSet.has(s.id)
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
                            <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 border-b border-slate-200/60 dark:border-white/10">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                                                {idx + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <h3 className="text-lg font-bold text-slate-900 break-words">
                                                    {routineExercise.exercise.name}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-slate-600">
                                                    <span className="flex items-center gap-1">
                                                        <Dumbbell className="h-4 w-4 shrink-0" />
                                                        {muscleName(routineExercise.exercise.primary_muscle_id)}
                                                    </span>
                                                    {routineExercise.exercise.equipment && (
                                                        <span className="truncate">• {equipmentLabel(routineExercise.exercise.equipment) ?? routineExercise.exercise.equipment}</span>
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
                            <div className="divide-y divide-slate-200/60 dark:divide-white/10">
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
                                                    <select
                                                        value={serie.type}
                                                        onChange={(e) => handleSerieTypeChange(routineExercise.id, serie.id, e.target.value as Serie["type"])}
                                                        aria-label={`Tipo serie ${serieIdx + 1}`}
                                                        className={`cursor-pointer rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${getSerieTypeClass(serie.type)}`}
                                                    >
                                                        <option value="warm-up">Calentamiento</option>
                                                        <option value="normal">Normal</option>
                                                        <option value="dropset">Dropset</option>
                                                        <option value="otro">Otro</option>
                                                    </select>
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
                                                        inputWidthClass="w-20"
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
                                                        inputWidthClass="w-20"
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
                <div className="fixed left-1/2 z-20 -translate-x-1/2 bottom-[calc(6rem+env(safe-area-inset-bottom))]">
                    <div className="flex items-center gap-2 rounded-full bg-slate-900 py-2 pl-4 pr-2 text-white shadow-lg">
                        <Timer className="h-4 w-4 text-blue-300" aria-hidden />
                        <span className="font-mono text-lg font-bold tabular-nums">
                            {formatRestTime(restTime)}
                        </span>
                        <span className="text-xs text-slate-300">descanso</span>
                        <button
                            onClick={() => startRestTimer(Math.min(restTime + 30, 5999))}
                            aria-label="Sumar 30 segundos al descanso"
                            className="rounded-full bg-slate-700 px-3 py-2 text-xs font-medium hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                            +30
                        </button>
                        <button
                            onClick={stopRestTimer}
                            aria-label="Saltar descanso"
                            className="rounded-full p-2.5 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                            <X className="h-4 w-4" aria-hidden />
                        </button>
                    </div>
                </div>
            )}

            {/* Footer fijo con acciones */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg pb-[env(safe-area-inset-bottom)] dark:bg-slate-900 dark:border-white/10">
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
