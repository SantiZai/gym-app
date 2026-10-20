"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import type { EditableRoutine } from "@/types/routine";
import { getRoutineFull } from "@/utils/routineUtils";
import { RoutineEditor } from "@/components/routine/RoutineEditor";

export default function EditarRutinaPage() {
    const params = useParams();
    const routineId = params.id as string;

    const [routine, setRoutine] = useState<EditableRoutine | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        if (!routineId) return;

        let alive = true;
        setLoading(true);
        setLoadFailed(false);

        getRoutineFull(routineId)
            .then(({ routine: data, exercises }) => {
                if (!alive) return;
                setRoutine({
                    id: data.id,
                    name: data.name,
                    description: data.description ?? "",
                    public: data.public,
                    exercises,
                });
            })
            .catch((error) => {
                console.error("Error cargando rutina:", error);
                if (!alive) return;
                setLoadFailed(true);
            })
            .finally(() => {
                if (!alive) return;
                setLoading(false);
            });

        return () => {
            alive = false;
        };
    }, [routineId, retryKey]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
                <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
                    <div className="h-14 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10" />
                    <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10" />
                    <div className="h-44 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10" />
                    <div className="h-44 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/10" />
                </div>
            </div>
        );
    }

    if (loadFailed || !routine) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
                <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10">
                    <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
                    <h1 className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        No se pudo cargar la rutina
                    </h1>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        Revisá tu conexión e intentá de nuevo.
                    </p>
                    <button
                        type="button"
                        onClick={() => setRetryKey((key) => key + 1)}
                        className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Reintentar
                    </button>
                    <Link
                        href="/rutinas"
                        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Volver a rutinas
                    </Link>
                </div>
            </div>
        );
    }

    return <RoutineEditor key={routine.id ?? routineId} mode="edit" routineId={routine.id ?? routineId} initialRoutine={routine} />;
}
