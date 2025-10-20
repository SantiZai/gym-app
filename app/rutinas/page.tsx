"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Calendar, Clock, Users, Edit, Trash2, Play } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Routine } from "@/types/db";
import { getUserRoutines } from "@/utils/routineUtils";
import { Button } from "@/components/ui/button";
import { startSession } from "@/utils/sessionUtils";

export default function RutinasPage() {
  const { user } = useAuth();
  const [rutinas, setRutinas] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserRoutines(user.id).then((data) => {
      setRutinas(data);
      setLoading(false);
    })
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mis Rutinas</h1>
            <p className="mt-2 text-gray-600">
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
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Rutinas</p>
                <p className="text-2xl font-bold text-gray-900">{rutinas.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Públicas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {rutinas.filter(r => r.public).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Última Actualización</p>
                <p className="text-sm font-bold text-gray-900">
                  {rutinas.length > 0 ? formatDate(rutinas[0].updated_at) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rutinas Grid */}
        {rutinas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes rutinas creadas
            </h3>
            <p className="text-gray-600 mb-6">
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
                className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {rutina.name}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
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
                  
                  <div className="flex items-center text-sm text-gray-500 mb-4">
                    <Calendar className="h-4 w-4 mr-1" />
                    Creada el {formatDate(rutina.created_at)}
                  </div>
                  
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
                      className="inline-flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    <button className="inline-flex items-center justify-center px-3 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors duration-200">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}