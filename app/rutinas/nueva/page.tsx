"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Filter, Plus, X, Save, Dumbbell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Exercise, RoutineExercise } from "@/types/db";
import { createClient } from "@/utils/supabase/client";
import { getExercises } from "@/utils/exercisesUtils";
import { createRoutineBasic } from "@/utils/routineUtils";

interface ExerciseWithSelected extends Exercise {
    selected?: boolean;
    orden?: number;
}

export default function NuevaRutinaPage() {
    const { user } = useAuth();
    const [rutinaNombre, setRutinaNombre] = useState("");
    const [rutinaDescripcion, setRutinaDescripcion] = useState("");
    const [rutinaPublica, setRutinaPublica] = useState(false);

    const [ejercicios, setEjercicios] = useState<ExerciseWithSelected[]>([]);
    const [ejerciciosFiltrados, setEjerciciosFiltrados] = useState<ExerciseWithSelected[]>([]);
    const [ejerciciosSeleccionados, setEjerciciosSeleccionados] = useState<ExerciseWithSelected[]>([]);

    const [busqueda, setBusqueda] = useState("");
    const [filtroMusculo, setFiltroMusculo] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("");
    const [filtroEquipamiento, setFiltroEquipamiento] = useState("");

    const [loading, setLoading] = useState(true);
    const [guardando, setGuardando] = useState(false);

    // Datos de ejemplo para ejercicios
    useEffect(() => {
        getExercises().then(data => {
            console.log(data)
            setEjercicios(data);
            setEjerciciosFiltrados(data);
            setLoading(false);
        })
    }, []);

    // Filtrar ejercicios
    useEffect(() => {
        let filtrados = ejercicios.filter(ejercicio => {
            const coincideBusqueda = ejercicio.name.toLowerCase().includes(busqueda.toLowerCase());
            const coincideMusculo = !filtroMusculo || ejercicio.muscle === filtroMusculo;
            const coincideTipo = !filtroTipo || ejercicio.type === filtroTipo;
            const coincideEquipamiento = !filtroEquipamiento || ejercicio.equipment === filtroEquipamiento;

            return coincideBusqueda && coincideMusculo && coincideTipo && coincideEquipamiento;
        });

        setEjerciciosFiltrados(filtrados);
    }, [ejercicios, busqueda, filtroMusculo, filtroTipo, filtroEquipamiento]);

    const musculos = [...new Set(ejercicios.map(e => e.muscle).filter(Boolean))];
    const tipos = [...new Set(ejercicios.map(e => e.type).filter(Boolean))];
    const equipamientos = [...new Set(ejercicios.map(e => e.equipment).filter(Boolean))];

    const agregarEjercicio = (ejercicio: ExerciseWithSelected) => {
        if (!ejerciciosSeleccionados.find(e => e.id === ejercicio.id)) {
            const ejercicioConOrden = {
                ...ejercicio,
                selected: true,
                orden: ejerciciosSeleccionados.length + 1
            };
            setEjerciciosSeleccionados([...ejerciciosSeleccionados, ejercicioConOrden]);
        }
    };

    const removerEjercicio = (ejercicioId: string) => {
        const nuevosEjercicios = ejerciciosSeleccionados
            .filter(e => e.id !== ejercicioId)
            .map((e, index) => ({ ...e, orden: index + 1 }));
        setEjerciciosSeleccionados(nuevosEjercicios);
    };

    const moverEjercicio = (index: number, direccion: 'up' | 'down') => {
        if (
            (direccion === 'up' && index === 0) ||
            (direccion === 'down' && index === ejerciciosSeleccionados.length - 1)
        ) {
            return;
        }

        const nuevosEjercicios = [...ejerciciosSeleccionados];
        const targetIndex = direccion === 'up' ? index - 1 : index + 1;

        [nuevosEjercicios[index], nuevosEjercicios[targetIndex]] =
            [nuevosEjercicios[targetIndex], nuevosEjercicios[index]];

        // Actualizar orden
        nuevosEjercicios.forEach((ejercicio, i) => {
            ejercicio.orden = i + 1;
        });

        setEjerciciosSeleccionados(nuevosEjercicios);
    };

    const guardarRutina = async () => {
        if (!rutinaNombre.trim()) {
            alert("Por favor ingresa un nombre para la rutina");
            return;
        }

        if (ejerciciosSeleccionados.length === 0) {
            alert("Por favor selecciona al menos un ejercicio");
            return;
        }

        setGuardando(true);

        // TODO: Implementar guardado en base de datos
        const payload = {
            "nombre": "Pecho & Tríceps - Básica",
            "descripcion": "Rutina para fuerza",
            "publica": false,
            "ejercicios": [
                {
                    "ejercicio_id": "85da8260-59ff-41b0-9a41-e53ea5ccf45e",
                    "orden": 1,
                    "notas": "Primero press"
                },
                {
                    "ejercicio_id": "2dff2d3c-80af-4f6e-bf05-512473614a5c",
                    "orden": 2,
                    "notas": "Luego fondos"
                }
            ]
        }
        createRoutineBasic(payload).then((res) => {
            setGuardando(false)
            window.location.href = "/rutinas";
        })
    };

    const limpiarFiltros = () => {
        setBusqueda("");
        setFiltroMusculo("");
        setFiltroTipo("");
        setFiltroEquipamiento("");
    };

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

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center">
                        <Link
                            href="/rutinas"
                            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200 mr-4"
                        >
                            <ArrowLeft className="h-5 w-5 mr-1" />
                            Volver
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Nueva Rutina</h1>
                            <p className="mt-2 text-gray-600">
                                Crea una rutina personalizada seleccionando ejercicios
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={guardarRutina}
                        disabled={guardando}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors duration-200 shadow-sm disabled:opacity-50"
                    >
                        {guardando ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                            <Save className="h-5 w-5 mr-2" />
                        )}
                        {guardando ? "Guardando..." : "Guardar Rutina"}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Panel de información de la rutina */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 sticky top-8">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                Información de la Rutina
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nombre de la rutina *
                                    </label>
                                    <input
                                        type="text"
                                        value={rutinaNombre}
                                        onChange={(e) => setRutinaNombre(e.target.value)}
                                        placeholder="Ej: Rutina de Pecho y Tríceps"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Descripción
                                    </label>
                                    <textarea
                                        value={rutinaDescripcion}
                                        onChange={(e) => setRutinaDescripcion(e.target.value)}
                                        placeholder="Describe tu rutina..."
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="publica"
                                        checked={rutinaPublica}
                                        onChange={(e) => setRutinaPublica(e.target.checked)}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="publica" className="ml-2 text-sm text-gray-700">
                                        Hacer rutina pública
                                    </label>
                                </div>
                            </div>

                            {/* Ejercicios seleccionados */}
                            <div className="mt-6">
                                <h3 className="text-md font-medium text-gray-900 mb-3">
                                    Ejercicios Seleccionados ({ejerciciosSeleccionados.length})
                                </h3>

                                {ejerciciosSeleccionados.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">
                                        No has seleccionado ejercicios aún
                                    </p>
                                ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {ejerciciosSeleccionados.map((ejercicio, index) => (
                                            <div
                                                key={ejercicio.id}
                                                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                                            >
                                                <div className="flex items-center flex-1">
                                                    <span className="text-xs font-medium text-gray-500 mr-2">
                                                        {ejercicio.orden}
                                                    </span>
                                                    <span className="text-sm font-medium text-gray-900 truncate">
                                                        {ejercicio.name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <button
                                                        onClick={() => moverEjercicio(index, 'up')}
                                                        disabled={index === 0}
                                                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                    >
                                                        ↑
                                                    </button>
                                                    <button
                                                        onClick={() => moverEjercicio(index, 'down')}
                                                        disabled={index === ejerciciosSeleccionados.length - 1}
                                                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                    >
                                                        ↓
                                                    </button>
                                                    <button
                                                        onClick={() => removerEjercicio(ejercicio.id)}
                                                        className="p-1 text-red-400 hover:text-red-600"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Panel de selección de ejercicios */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                            {/* Filtros */}
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        Seleccionar Ejercicios
                                    </h2>
                                    <button
                                        onClick={limpiarFiltros}
                                        className="text-sm text-blue-600 hover:text-blue-700"
                                    >
                                        Limpiar filtros
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Búsqueda */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={busqueda}
                                            onChange={(e) => setBusqueda(e.target.value)}
                                            placeholder="Buscar ejercicios..."
                                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* Filtro por músculo */}
                                    <select
                                        value={filtroMusculo}
                                        onChange={(e) => setFiltroMusculo(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="">Todos los músculos</option>
                                        {musculos.map(musculo => (
                                            <option key={musculo} value={musculo}>{musculo}</option>
                                        ))}
                                    </select>

                                    {/* Filtro por tipo */}
                                    <select
                                        value={filtroTipo}
                                        onChange={(e) => setFiltroTipo(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="">Todos los tipos</option>
                                        {tipos.map(tipo => (
                                            <option key={tipo} value={tipo}>{tipo}</option>
                                        ))}
                                    </select>

                                    {/* Filtro por equipamiento */}
                                    <select
                                        value={filtroEquipamiento}
                                        onChange={(e) => setFiltroEquipamiento(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="">Todo el equipamiento</option>
                                        {equipamientos.map(equipamiento => (
                                            <option key={equipamiento} value={equipamiento}>{equipamiento}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Lista de ejercicios */}
                            <div className="p-6">
                                {ejerciciosFiltrados.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-500">No se encontraron ejercicios</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {ejerciciosFiltrados.map((ejercicio) => {
                                            const yaSeleccionado = ejerciciosSeleccionados.find(e => e.id === ejercicio.id);

                                            return (
                                                <div
                                                    key={ejercicio.id}
                                                    className={`p-4 border rounded-lg transition-all duration-200 ${yaSeleccionado
                                                        ? 'border-blue-200 bg-blue-50'
                                                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <h3 className="font-medium text-gray-900 mb-1">
                                                                {ejercicio.name}
                                                            </h3>
                                                            <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                                                                <span>💪 {ejercicio.muscle}</span>
                                                                <span>🏋️ {ejercicio.equipment}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-600 line-clamp-2">
                                                                {ejercicio.instructions}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() =>
                                                                yaSeleccionado
                                                                    ? removerEjercicio(ejercicio.id)
                                                                    : agregarEjercicio(ejercicio)
                                                            }
                                                            className={`ml-4 p-2 rounded-lg transition-colors duration-200 ${yaSeleccionado
                                                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                                                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                                                }`}
                                                        >
                                                            {yaSeleccionado ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
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
                </div>
            </div>
        </div>
    );
}
