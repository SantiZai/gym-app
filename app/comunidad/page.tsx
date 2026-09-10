"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dumbbell, Search, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { forkRoutine, getPublicRoutines, type PublicRoutine } from "@/utils/communityUtils";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function ComunidadPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [routines, setRoutines] = useState<PublicRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [forkingId, setForkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    getPublicRoutines(user.id)
      .then((data) => alive && setRoutines(data))
      .catch((error) => {
        console.error("Error cargando comunidad:", error);
        if (alive) setFailed(true);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return routines;
    return routines.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        r.authorName.toLowerCase().includes(q)
    );
  }, [routines, search]);

  const handleFork = async (id: string, name: string) => {
    setForkingId(id);
    try {
      await forkRoutine(id);
      toast.success(`"${name}" copiada a tus rutinas`);
      router.push("/rutinas");
    } catch (error) {
      console.error("Error copiando rutina:", error);
      toast.error("No se pudo copiar la rutina. Intenta nuevamente.");
    } finally {
      setForkingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[280px] w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <EmptyState
            title="Inicia sesión para ver la comunidad"
            description="Descubrí rutinas públicas de otros usuarios y copialas a tu cuenta."
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

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title="Comunidad"
          description="Rutinas públicas para descubrir ideas y copiarlas a tu cuenta."
        />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, descripción o autor…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        ) : failed ? (
          <EmptyState
            title="La comunidad no está disponible"
            description="Falta aplicar la migración de lectura pública (sql/migrations/community_public_read.sql)."
            icon={Users}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={routines.length === 0 ? "Todavía no hay rutinas públicas" : "Sin resultados"}
            description={
              routines.length === 0
                ? "Cuando alguien marque una rutina como pública va a aparecer acá."
                : "Probá con otra búsqueda."
            }
            icon={Dumbbell}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((r) => (
              <article
                key={r.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-slate-900">{r.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {r.description || "Sin descripción"}
                    </p>
                  </div>
                  {r.category ? (
                    <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {r.category}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {r.authorName.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate font-medium">{r.authorName}</span>
                  <span aria-hidden>·</span>
                  <span>{r.exercisesCount} ejercicios</span>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/comunidad/${r.id}`}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Ver detalle
                  </Link>
                  <button
                    onClick={() => handleFork(r.id, r.name)}
                    disabled={forkingId === r.id}
                    className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {forkingId === r.id ? "Copiando…" : "Usar rutina"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
