"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Save,
    Plus,
    Trash2,
    ChevronUp,
    ChevronDown,
    RotateCcw,
    Search,
    X
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Routine, Exercise, Serie, RoutineExercise } from "@/types/db";
import { getRoutineById, getRoutineExercises } from "@/utils/routineUtils";
import { getExercisesByIds, getExercises } from "@/utils/exercisesUtils";

const TIPOS_SERIE = [
    { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-800" },
    { value: "warm-up", label: "Calentamiento", color: "bg-yellow-100 text-yellow-800" },
    { value: "cooldown", label: "Descanso", color: "bg-gray-100 text-gray-800" }
];

interface MappedExercise extends Exercise {
    routine_exercise_id?: string | null;
    orden?: number | null;
    notes?: string | null;
    series: Serie[];
}

interface RoutineComplete extends Routine {
    exercises: MappedExercise[];
}

export default function EditarRutinaPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const rutinaId = params.id as string;

    const [rutina, setRutina] = useState<RoutineComplete | null>(null);
    const [loading, setLoading] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [editandoSerie, setEditandoSerie] = useState<string | null>(null);

    const [routineExercises, setRoutineExercises] = useState<RoutineExercise[]>([]);

    // Modal / picker states
    const [pickerOpen, setPickerOpen] = useState(false);
    const [allExercises, setAllExercises] = useState<Exercise[]>([]);
    const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
    const [searchText, setSearchText] = useState("");
    const [filterMuscle, setFilterMuscle] = useState("");
    const [filterType, setFilterType] = useState("");
    const [filterEquipment, setFilterEquipment] = useState("");

    useEffect(() => {
        const loadRoutineData = async () => {
            try {
                setLoading(true);
                const routine: Routine = await getRoutineById(rutinaId);
                const routineExercises: RoutineExercise[] = await getRoutineExercises(rutinaId);
                const exerciseIds: string[] = routineExercises.map((re: any) => re.exercise_id);
                const exercisesFromApi: Exercise[] = await getExercisesByIds(exerciseIds);

                // Mapear ejercicios: asignar routine_exercise_id, orden, notes y series vacías
                const exercisesMapped: MappedExercise[] = exercisesFromApi.map((ex) => {
                    const re = routineExercises.find((r) => r.exercise_id === ex.id);
                    return {
                        ...ex,
                        routine_exercise_id: re?.id ?? null,
                        orden: re?.orden ?? null,
                        notes: re?.notes ?? null,
                        series: [] // inicializamos vacío: las series se crearán al editar
                    };
                });

                const completeRoutine: RoutineComplete = {
                    ...routine,
                    exercises: exercisesMapped
                };

                setRutina(completeRoutine);
                setRoutineExercises(routineExercises);
            } catch (error) {
                console.error("Error loading routine:", error);
            } finally {
                setLoading(false);
            }
        };

        loadRoutineData();
    }, [rutinaId]);

    // Cargar catálogo completo de ejercicios (para el picker) una sola vez
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const all = await getExercises();
                if (!mounted) return;
                setAllExercises(all);
                setFilteredExercises(all);
            } catch (err) {
                console.error("Error cargando ejercicios:", err);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Filtrado en picker
    useEffect(() => {
        const lower = searchText.trim().toLowerCase();
        const filtered = allExercises.filter((e) => {
            const matchesSearch =
                !lower ||
                e.name.toLowerCase().includes(lower) ||
                (e.muscle ?? "").toLowerCase().includes(lower) ||
                (e.instructions ?? "").toLowerCase().includes(lower);
            const matchesMuscle = !filterMuscle || e.muscle === filterMuscle;
            const matchesType = !filterType || e.type === filterType;
            const matchesEquipment = !filterEquipment || e.equipment === filterEquipment;
            return matchesSearch && matchesMuscle && matchesType && matchesEquipment;
        });
        setFilteredExercises(filtered);
    }, [allExercises, searchText, filterMuscle, filterType, filterEquipment]);

    const musculos = useMemo(() => [...new Set(allExercises.map((e) => e.muscle).filter(Boolean))], [allExercises]);
    const tipos = useMemo(() => [...new Set(allExercises.map((e) => e.type).filter(Boolean))], [allExercises]);
    const equipamientos = useMemo(() => [...new Set(allExercises.map((e) => e.equipment).filter(Boolean))], [allExercises]);

    // helper id temporal para nuevas series
    const genTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Agregar ejercicio desde picker: crea MappedExercise y lo agrega al final
    const agregarEjercicioDesdePicker = (exercise: Exercise) => {
        if (!rutina) return;
        if (rutina.exercises.find((ex) => ex.id === exercise.id)) {
            // ya agregado
            return;
        }
        const nueva: MappedExercise = {
            ...exercise,
            routine_exercise_id: null, // pendiente de crear en DB al guardar
            orden: (rutina.exercises.length ?? 0) + 1,
            notes: null,
            series: [] // vacías por ahora
        };
        setRutina((prev) => {
            if (!prev) return prev;
            return { ...prev, exercises: [...prev.exercises, nueva] };
        });
    };

    // Agregar serie a un exercise (usa routine_exercise_id para relacionar cuando exista)
    const agregarSerie = (routineExerciseId: string | null) => {
        if (!rutina) return;
        if (!routineExerciseId && !rutina) return;

        setRutina((prev) => {
            if (!prev) return prev;
            const newExercises = prev.exercises.map((ex) => {
                // match by routine_exercise_id OR by exercise id when rut_exercise_id is null
                const matches =
                    ex.routine_exercise_id === routineExerciseId ||
                    (routineExerciseId === ex.id) ||
                    (ex.routine_exercise_id === null && ex.id === routineExerciseId);
                if (!matches) return ex;
                const ultima = ex.series[ex.series.length - 1];
                const nuevaSerie: Serie = {
                    id: genTempId(),
                    routine_exercise_id: ex.routine_exercise_id ?? "",
                    type: "normal",
                    reps: ultima?.reps ?? "0",
                    weight: ultima?.weight ?? "0",
                    orden: (ex.series.length ?? 0) + 1,
                    notes: null
                };
                return { ...ex, series: [...ex.series, nuevaSerie] };
            });
            return { ...prev, exercises: newExercises };
        });
    };

    const eliminarSerie = (exerciseId: string, serieId: string) => {
        if (!rutina) return;

        setRutina((prev) => {
            if (!prev) return prev;
            const newExercises = prev.exercises.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                const filtered = ex.series.filter((s) => s.id !== serieId);
                const recalculated = filtered.map((s, idx) => ({ ...s, orden: idx + 1 }));
                return { ...ex, series: recalculated };
            });
            return { ...prev, exercises: newExercises };
        });
    };

    const actualizarSerie = (exerciseId: string, serieId: string, campo: keyof Serie, valor: any) => {
        if (!rutina) return;

        setRutina((prev) => {
            if (!prev) return prev;
            const newExercises = prev.exercises.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                const newSeries = ex.series.map((s) => (s.id === serieId ? { ...s, [campo]: valor } : s));
                return { ...ex, series: newSeries };
            });
            return { ...prev, exercises: newExercises };
        });
    };

    const moverSerie = (exerciseId: string, serieIndex: number, direccion: "up" | "down") => {
        if (!rutina) return;

        setRutina((prev) => {
            if (!prev) return prev;
            const newExercises = prev.exercises.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                const arr = [...ex.series];
                const targetIndex = direccion === "up" ? serieIndex - 1 : serieIndex + 1;
                if (targetIndex < 0 || targetIndex >= arr.length) return ex;
                [arr[serieIndex], arr[targetIndex]] = [arr[targetIndex], arr[serieIndex]];
                const recalculated = arr.map((s, idx) => ({ ...s, orden: idx + 1 }));
                return { ...ex, series: recalculated };
            });
            return { ...prev, exercises: newExercises };
        });
    };

    const duplicarSerie = (exerciseId: string, serieId: string) => {
        if (!rutina) return;

        setRutina((prev) => {
            if (!prev) return prev;
            const newExercises = prev.exercises.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                const idx = ex.series.findIndex((s) => s.id === serieId);
                if (idx === -1) return ex;
                const serie = ex.series[idx];
                const nueva: Serie = {
                    ...serie,
                    id: genTempId(),
                    orden: idx + 2
                } as Serie;
                const arr = [...ex.series];
                arr.splice(idx + 1, 0, nueva);
                const recalculated = arr.map((s, i) => ({ ...s, orden: i + 1 }));
                return { ...ex, series: recalculated };
            });
            return { ...prev, exercises: newExercises };
        });
    };

    const moverEjercicio = (ejercicioIndex: number, direccion: "up" | "down") => {
        if (!rutina) return;

        setRutina((prev) => {
            if (!prev) return prev;
            const arr = [...prev.exercises];
            const targetIndex = direccion === "up" ? ejercicioIndex - 1 : ejercicioIndex + 1;
            if (targetIndex < 0 || targetIndex >= arr.length) return prev;
            [arr[ejercicioIndex], arr[targetIndex]] = [arr[targetIndex], arr[ejercicioIndex]];
            const ordered = arr.map((ex, idx) => ({ ...ex, orden: idx + 1 }));
            return { ...prev, exercises: ordered };
        });
    };

    const guardarRutina = async () => {
        setGuardando(true);

        // TODO: implementar guardado real (RPC / múltiples inserts)
        setTimeout(() => {
            setGuardando(false);
            alert("Rutina actualizada exitosamente!");
            router.push("/rutinas");
        }, 1000);
    };

    const getTipoSerieInfo = (tipo: string) => {
        return TIPOS_SERIE.find((t) => t.value === tipo) || TIPOS_SERIE[0];
    };

    // resumen computado
    const totalSeries = rutina?.exercises.reduce((total, ej) => total + (ej.series?.length || 0), 0) ?? 0;
    const totalReps = rutina?.exercises.reduce((total, ej) => {
        return total + (ej.series?.reduce((st, s) => st + (Number(s.reps) || 0), 0) || 0);
    }, 0) ?? 0;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!rutina) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900">Rutina no encontrada</h1>
                        <Link href="/rutinas" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
                            Volver a rutinas
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <Link
                    href="/rutinas"
                    className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200 mr-4"
                >
                    <ArrowLeft className="h-5 w-5 mr-1" />
                    Volver
                </Link>
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Editar Rutina</h1>
                            <p className="mt-2 text-gray-600">{rutina.name}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPickerOpen(true)}
                            className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 md:px-4"
                        >
                            <Plus className="h-6 w-6 md:h-5 md:w-5 md:mr-2" />
                            <span className="hidden md:inline">Agregar ejercicio</span>
                        </button>

                        <button
                            onClick={guardarRutina}
                            disabled={guardando}
                            className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors duration-200 shadow-sm disabled:opacity-50 md:px-4"
                        >
                            {guardando ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent md:mr-2"></div>
                            ) : (
                                <svg className="h-6 w-6 md:h-5 md:w-5 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                            <span className="hidden md:inline">{guardando ? "Guardando..." : "Guardar Cambios"}</span>
                        </button>
                    </div>
                </div>

                {/* Información de la rutina */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de la Rutina</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
                            <input
                                type="text"
                                value={rutina.name}
                                onChange={(e) => setRutina({ ...rutina, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
                            <input
                                type="text"
                                value={rutina.description || ""}
                                onChange={(e) => setRutina({ ...rutina, description: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                    {/* Resumen */}
                    <div className="mt-8 bg-gray-100 rounded-xl p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{rutina.exercises.length}</div>
                                <div className="text-sm text-gray-600 font-bold">Ejercicios</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{totalSeries}</div>
                                <div className="text-sm text-gray-600 font-bold">Series Totales</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{Math.round(totalReps)}</div>
                                <div className="text-sm text-gray-600 font-bold">Repeticiones Totales</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lista de ejercicios */}
                <div className="space-y-6">
                    {rutina.exercises.map((ejercicio, ejercicioIndex) => (
                        <div key={ejercicio.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
                            {/* Header del ejercicio */}
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex flex-col space-y-1">
                                            <button
                                                onClick={() => moverEjercicio(ejercicioIndex, "up")}
                                                disabled={ejercicioIndex === 0}
                                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                            >
                                                <ChevronUp className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => moverEjercicio(ejercicioIndex, "down")}
                                                disabled={ejercicioIndex === rutina.exercises.length - 1}
                                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                            >
                                                <ChevronDown className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {ejercicio.orden ?? ejercicioIndex + 1}. {ejercicio.name}
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                {ejercicio.muscle} • {ejercicio.equipment}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => agregarSerie(ejercicio.routine_exercise_id ?? ejercicio.id)}
                                        className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Serie
                                    </button>
                                </div>
                            </div>

                            {/* Series */}
                            <div className="p-6">
                                <div className="space-y-3">
                                    {/* Header de la tabla */}
                                    <div className="grid grid-cols-12 gap-3 text-sm font-medium text-gray-700 pb-2 border-b border-gray-200">
                                        <div className="col-span-1">#</div>
                                        <div className="col-span-2">Tipo</div>
                                        <div className="col-span-2">Peso (kg)</div>
                                        <div className="col-span-2">Reps</div>
                                        <div className="col-span-3">Notas</div>
                                        <div className="col-span-2">Acciones</div>
                                    </div>

                                    {/* Filas de series (ahora por ejercicio: ejercicio.series) */}
                                    {ejercicio.series.map((serie, serieIndex) => {
                                        const tipoInfo = getTipoSerieInfo(serie.type);

                                        return (
                                            <div
                                                key={serie.id}
                                                className="grid grid-cols-12 gap-3 items-center py-2 hover:bg-gray-50 rounded-lg"
                                            >
                                                {/* Número de serie */}
                                                <div className="col-span-1 text-sm font-medium text-gray-900">
                                                    {serieIndex + 1}
                                                </div>

                                                {/* Tipo de serie */}
                                                <div className="col-span-2">
                                                    <select
                                                        value={serie.type}
                                                        onChange={(e) => actualizarSerie(ejercicio.id, serie.id, "type", e.target.value as any)}
                                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        {TIPOS_SERIE.map((tipo) => (
                                                            <option key={tipo.value} value={tipo.value}>
                                                                {tipo.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Peso */}
                                                <div className="col-span-2">
                                                    <input
                                                        type="number"
                                                        value={serie.weight ?? ""}
                                                        onChange={(e) => actualizarSerie(ejercicio.id, serie.id, "weight", String(e.target.value))}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                                        placeholder="0"
                                                    />
                                                </div>

                                                {/* Repeticiones */}
                                                <div className="col-span-2">
                                                    <input
                                                        type="number"
                                                        value={serie.reps ?? ""}
                                                        onChange={(e) => actualizarSerie(ejercicio.id, serie.id, "reps", String(e.target.value))}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                                        placeholder="0"
                                                    />
                                                </div>

                                                {/* Notas */}
                                                <div className="col-span-3">
                                                    <input
                                                        type="text"
                                                        value={serie.notes ?? ""}
                                                        onChange={(e) => actualizarSerie(ejercicio.id, serie.id, "notes", e.target.value)}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                                        placeholder="Notas..."
                                                    />
                                                </div>

                                                {/* Acciones */}
                                                <div className="col-span-2 flex items-center space-x-1">
                                                    <button
                                                        onClick={() => moverSerie(ejercicio.id, serieIndex, "up")}
                                                        disabled={serieIndex === 0}
                                                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                        title="Mover arriba"
                                                    >
                                                        <ChevronUp className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => moverSerie(ejercicio.id, serieIndex, "down")}
                                                        disabled={serieIndex === ejercicio.series.length - 1}
                                                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                        title="Mover abajo"
                                                    >
                                                        <ChevronDown className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => duplicarSerie(ejercicio.id, serie.id)}
                                                        className="p-1 text-blue-400 hover:text-blue-600"
                                                        title="Duplicar serie"
                                                    >
                                                        <RotateCcw className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => eliminarSerie(ejercicio.id, serie.id)}
                                                        disabled={ejercicio.series.length <= 1}
                                                        className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30"
                                                        title="Eliminar serie"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Notas del ejercicio */}
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Notas del ejercicio</label>
                                    <textarea
                                        value={ejercicio.notes ?? ""}
                                        onChange={(e) => {
                                            const nueva = { ...rutina };
                                            const idx = nueva.exercises.findIndex((x) => x.id === ejercicio.id);
                                            if (idx !== -1) {
                                                nueva.exercises[idx] = { ...nueva.exercises[idx], notes: e.target.value };
                                                setRutina(nueva);
                                            }
                                        }}
                                        rows={2}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Notas adicionales para este ejercicio..."
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ---------- PICKER MODAL ---------- */}
            {pickerOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-10 px-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setPickerOpen(false)} />
                    <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-lg overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between flex-shrink-0">
                            <h3 className="text-xl font-semibold p-4">Agregar ejercicios</h3>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPickerOpen(false)} className="px-3 py-2 text-sm cursor-pointer">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                        <div className="p-4 flex-shrink-0">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    autoFocus
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Buscar ejercicios..."
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center w-full gap-3">
                                <div className="w-full flex flex-col md:flex-row gap-2">
                                    <select
                                        value={filterMuscle}
                                        onChange={(e) => setFilterMuscle(e.target.value)}
                                        className="px-3 py-2 border w-full rounded-lg"
                                    >
                                        <option value="">Todos los músculos</option>
                                        {musculos.map((m) => (
                                            <option key={m} value={m}>
                                                {m}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value)}
                                        className="px-3 py-2 border w-full rounded-lg"
                                    >
                                        <option value="">Todos los tipos</option>
                                        {tipos.map((t) => (
                                            <option key={t} value={t}>
                                                {t}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={filterEquipment}
                                        onChange={(e) => setFilterEquipment(e.target.value)}
                                        className="px-3 py-2 border w-full rounded-lg"
                                    >
                                        <option value="">Todo el equipamiento</option>
                                        {equipamientos.map((eq) => (
                                            <option key={eq} value={eq}>
                                                {eq}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1 min-h-0">
                            {filteredExercises.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-gray-500">No se encontraron ejercicios</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {filteredExercises.map((ej) => {
                                        const ya = rutina?.exercises.some((ex) => ex.id === ej.id);
                                        return (
                                            <div
                                                key={ej.id}
                                                className={`p-3 border rounded-lg flex items-start justify-between ${ya ? "bg-blue-50 border-blue-200" : "border-gray-200"}`}
                                            >
                                                <div className="flex-1 pr-3">
                                                    <h4 className="font-medium text-gray-900">{ej.name}</h4>
                                                    <div className="text-xs text-gray-500 mt-1">{ej.muscle} • {ej.equipment}</div>
                                                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">{ej.instructions}</p>
                                                </div>
                                                <div>
                                                    <button
                                                        onClick={() => {
                                                            if (!rutina) return;
                                                            if (ya) {
                                                                // remover si ya está
                                                                setRutina((prev) => {
                                                                    if (!prev) return prev;
                                                                    const filtered = prev.exercises.filter((x) => x.id !== ej.id).map((x, i) => ({ ...x, orden: i + 1 }));
                                                                    return { ...prev, exercises: filtered };
                                                                });
                                                            } else {
                                                                agregarEjercicioDesdePicker(ej);
                                                            }
                                                        }}
                                                        className={`px-3 py-2 rounded ${ya ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}
                                                    >
                                                        {ya ? "Remover" : "Agregar"}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* ---------- END PICKER MODAL ---------- */}
        </div>
    );
}
