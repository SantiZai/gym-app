"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Calendar, Clock, Users, Edit, Trash2, Play, Check, X, LayoutTemplate, History } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Routine } from "@/types/db";
import { deleteRoutine, getUserRoutines } from "@/utils/routineUtils";
import { getUserSessions } from "@/utils/sessionUtils";
import { aggregateRoutineHistory, type RoutineHistory } from "@/lib/routineHistory";
import { createRoutineFromTemplate, MissingExercisesError } from "@/utils/templateUtils";
import { ROUTINE_TEMPLATES } from "@/lib/routineTemplates";
import { Button } from "@/components/ui/button";
import { startSession } from "@/utils/sessionUtils";
import { toast } from "sonner";

export default function RutinasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rutinas, setRutinas] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [usingTemplate, setUsingTemplate] = useState<string | null>(null);
  const [historyByRoutine, setHistoryByRoutine] = useState<Record<string, RoutineHistory>>({});

  const handleUseTemplate = async (key: string) => {
    const template = ROUTINE_TEMPLATES.find((t) => t.key === key);
    if (!template) return;
    setUsingTemplate(key);
    try {
      const newId = await createRoutineFromTemplate(template);
      toast.success(`Rutina "${template.name}" creada`);
      router.push(`/rutinas/${newId}/editar`);
    } catch (error) {
      console.error("Error creando rutina desde plantilla:", error);
      if (error instanceof MissingExercisesError) {
        toast.error(`Faltan ejercicios en el catálogo: ${error.missing.join(", ")}`);
      } else {
        toast.error("No se pudo crear la rutina. Intenta nuevamente.");
      }
    } finally {
      setUsingTemplate(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setDeletingId(id);
    try {
      await deleteRoutine(id);
      setRutinas((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error("Error eliminando rutina:", error);
      toast.error("No se pudo eliminar la rutina. Intenta nuevamente.");
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    getUserRoutines(user.id).then((data) => {
      setRutinas(data);
      setLoading(false);
    })
    getUserSessions(user.id)
      .then((sessions) => setHistoryByRoutine(aggregateRoutineHistory(sessions)))
      .catch(() => setHistoryByRoutine({}));
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Mis Rutinas</h1>
            <p className="mt-2 text-slate-600">
              Gestiona y organiza tus rutinas de entrenamiento
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Link
              href="/rutinas/nueva"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 shadow-sm"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nueva Rutina
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Total Rutinas</p>
                <p className="text-2xl font-bold text-slate-900">{rutinas.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Públicas</p>
                <p className="text-2xl font-bold text-slate-900">
                  {rutinas.filter(r => r.public).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Última Actualización</p>
                <p className="text-sm font-bold text-slate-900">
                  {rutinas.length > 0 ? formatDate(rutinas[rutinas.length - 1].updated_at) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Plantillas */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <LayoutTemplate className="h-5 w-5 text-slate-500" aria-hidden />
            <h2 className="text-lg font-semibold text-slate-900">Empezar desde una plantilla</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ROUTINE_TEMPLATES.map((t) => (
              <div
                key={t.key}
                className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col"
              >
                <span className="self-start rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                  {t.category}
                </span>
                <h3 className="mt-2 text-base font-semibold text-slate-900">{t.name}</h3>
                <p className="mt-1 text-sm text-slate-500 line-clamp-2">{t.description}</p>
                <p className="mt-2 text-xs text-slate-500">{t.exercises.length} ejercicios</p>
                <button
                  onClick={() => handleUseTemplate(t.key)}
                  disabled={usingTemplate !== null}
                  className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {usingTemplate === t.key ? "Creando…" : "Usar plantilla"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Rutinas Grid */}
        {rutinas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-slate-100">
            <Calendar className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              No tienes rutinas creadas
            </h3>
            <p className="text-slate-600 mb-6">
              Crea tu primera rutina para comenzar a entrenar
            </p>
            <Link
              href="/rutinas/nueva"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              Crear Primera Rutina
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rutinas.map((rutina) => (
              <div
                key={rutina.id}
                className="bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        {rutina.name}
                      </h3>
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {rutina.description || 'Sin descripción'}
                      </p>
                    </div>
                    {rutina.public && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Users className="h-3 w-3 mr-1" />
                        Pública
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center text-sm text-slate-500 mb-2">
                    <Calendar className="h-4 w-4 mr-1" />
                    Creada el {formatDate(rutina.created_at)}
                  </div>

                  {(() => {
                    const h = historyByRoutine[rutina.id];
                    if (!h || h.total === 0) {
                      return (
                        <p className="text-sm text-slate-400 mb-4">Sin sesiones todavía</p>
                      );
                    }
                    return (
                      <div className="flex items-center text-sm text-slate-500 mb-4">
                        <History className="h-4 w-4 mr-1" />
                        Última: {h.last ? formatDate(h.last) : "—"}
                        <span aria-hidden className="mx-1">·</span>
                        {h.monthCount} {h.monthCount === 1 ? "vez" : "veces"} este mes
                      </div>
                    );
                  })()}
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 cursor-pointer"
                      onClick={() => startSession(rutina.id)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Iniciar
                    </Button>
                    <Link
                      href={`/rutinas/${rutina.id}/editar`}
                      className="inline-flex items-center justify-center px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors duration-200"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    {confirmingId === rutina.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(rutina.id)}
                          disabled={deletingId === rutina.id}
                          title="Confirmar eliminación (las sesiones anteriores se conservan)"
                          className="inline-flex items-center justify-center px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          disabled={deletingId === rutina.id}
                          title="Cancelar"
                          className="inline-flex items-center justify-center px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors duration-200 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleDelete(rutina.id)}
                        title="Eliminar rutina (conserva su historial)"
                        className="inline-flex items-center justify-center px-3 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {confirmingId === rutina.id && (
                    <p className="mt-2 text-xs text-red-600">
                      Se eliminará la rutina, pero tus sesiones anteriores se conservan en las estadísticas. Confirma con ✓.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}