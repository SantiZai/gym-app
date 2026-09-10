"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Dumbbell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { forkRoutine, getPublicRoutineDetail, type PublicRoutineDetail } from "@/utils/communityUtils";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function ComunidadDetallePage() {
  const params = useParams();
  const router = useRouter();
  const routineId = params?.id as string;
  const { user, isLoading: authLoading } = useAuth();

  const [detail, setDetail] = useState<PublicRoutineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [forking, setForking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setDetail(await getPublicRoutineDetail(routineId));
    } catch (error) {
      console.error("Error cargando rutina pública:", error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const handleFork = async () => {
    if (!detail) return;
    setForking(true);
    try {
      await forkRoutine(detail.routine.id);
      toast.success(`"${detail.routine.name}" copiada a tus rutinas`);
      router.push("/rutinas");
    } catch (error) {
      console.error("Error copiando rutina:", error);
      toast.error("No se pudo copiar la rutina. Intenta nuevamente.");
    } finally {
      setForking(false);
    }
  };

  if (authLoading || (loading && user)) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-3xl space-y-4 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <EmptyState
            title="Inicia sesión para ver esta rutina"
            action={
              <Link
                href="/login"
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Iniciar sesión
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (failed || !detail) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <EmptyState
            title="Rutina no disponible"
            description="Puede que haya dejado de ser pública o falte la migración de comunidad."
            icon={Dumbbell}
            action={
              <Link
                href="/comunidad"
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Volver a comunidad
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const isMine = detail.routine.user_id === user.id;

  return (
    <div className="min-h-screen bg-slate-50 py-8 pb-28">
      <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
        <Link
          href="/comunidad"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Comunidad
        </Link>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{detail.routine.name}</h1>
              <p className="mt-1 text-sm text-slate-500">{detail.routine.description || "Sin descripción"}</p>
            </div>
            {detail.routine.category ? (
              <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                {detail.routine.category}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {detail.authorName.charAt(0).toUpperCase()}
            </span>
            <span className="font-medium">{detail.authorName}</span>
            <span aria-hidden>·</span>
            <span>{detail.exercises.length} ejercicios</span>
          </div>
        </div>

        <div className="space-y-4">
          {detail.exercises.map((item, idx) => (
            <div key={`${item.exercise.id}-${item.orden}`} className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-slate-900">{item.exercise.name}</h2>
                  <p className="truncate text-xs text-slate-500">
                    {[item.exercise.muscle, item.exercise.equipment].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </div>
              {item.series.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {item.series.map((s, i) => (
                    <li key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-500">Serie {i + 1}</span>
                      <span className="font-semibold text-slate-900">
                        {s.weight} kg × {s.reps}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-400">Sin series planificadas.</p>
              )}
              {item.notes ? <p className="mt-2 text-xs italic text-slate-500">💡 {item.notes}</p> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white shadow-lg">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:px-8">
          {isMine ? (
            <Link
              href={`/rutinas/${detail.routine.id}/editar`}
              className="block w-full rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-slate-800"
            >
              Es tu rutina — editarla
            </Link>
          ) : (
            <button
              onClick={handleFork}
              disabled={forking}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {forking ? "Copiando…" : "Usar esta rutina"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
