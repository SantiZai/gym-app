"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getGymById, getGymTrainers, manageGymTrainer } from "@/utils/gymUtils";
import type { Gym, TrainerScheduleEntry } from "@/types/db";
import { validateSchedule, WEEK_DAYS_LONG, formatScheduleLines } from "@/lib/gymSchedule";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function DisponibilidadPage() {
  const params = useParams();
  const router = useRouter();
  const gymId = params.id as string;
  const { user, isLoading: authLoading } = useAuth();

  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [especialidad, setEspecialidad] = useState("");
  const [entries, setEntries] = useState<TrainerScheduleEntry[]>([]);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      toast.error("Iniciá sesión");
      router.push(`/gimnasios/${gymId}`);
      return;
    }
    try {
      const [g, trainers] = await Promise.all([
        getGymById(gymId),
        getGymTrainers(gymId),
      ]);
      const mine = trainers.find((t) => t.user_id === user.id);
      if (!mine) {
        toast.error("Solo los profesores del gimnasio editan su disponibilidad");
        router.push(`/gimnasios/${gymId}`);
        return;
      }
      setGym(g);
      setEspecialidad(mine.specialty ?? "");
      setEntries((mine.schedule ?? []) as TrainerScheduleEntry[]);
    } catch {
      toast.error("No se pudo cargar tu disponibilidad");
      router.push("/gimnasios");
    } finally {
      setLoading(false);
    }
  }, [gymId, router, user, authLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const setRange = (day: number, idx: number, patch: Partial<TrainerScheduleEntry>) => {
    setEntries((prev) => {
      const dayRanges = prev.filter((e) => e.day === day);
      const others = prev.filter((e) => e.day !== day);
      const next = dayRanges.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      return [...others, ...next].sort((a, b) => a.day - b.day || (a.start < b.start ? -1 : 1));
    });
  };

  const addRange = (day: number) => {
    setEntries((prev) => [...prev, { day, start: "08:00", end: "12:00" }]
      .sort((a, b) => a.day - b.day || (a.start < b.start ? -1 : 1)));
  };

  const removeRange = (day: number, idx: number) => {
    setEntries((prev) => {
      const dayRanges = prev.filter((e) => e.day === day);
      const others = prev.filter((e) => e.day !== day);
      return [...others, ...dayRanges.filter((_, i) => i !== idx)];
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const check = validateSchedule(entries);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    setGuardando(true);
    try {
      await manageGymTrainer(gymId, user.id, "add", {
        specialty: especialidad.trim() || null,
        schedule: entries,
      });
      toast.success("Disponibilidad actualizada");
      router.push(`/gimnasios/${gymId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  if (loading || !gym) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-2xl space-y-4 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <Link
          href={`/gimnasios/${gymId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al gimnasio
        </Link>
        <div className="mt-4">
          <SectionHeader
            title={`Mi disponibilidad en ${gym.name}`}
            description="Tus días y horarios visibles en el perfil del gimnasio."
          />
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Especialidad <span className="font-normal text-slate-400">(opcional)</span>
            </span>
            <Input
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
              placeholder="Musculación, Funcional…"
              maxLength={80}
              className="h-11"
            />
          </label>

          <div className="space-y-3">
            {WEEK_DAYS_LONG.map((dayName, day) => {
              const ranges = entries.filter((e) => e.day === day);
              return (
                <div key={day} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{dayName}</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => addRange(day)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Agregar
                    </Button>
                  </div>
                  {ranges.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Sin horarios este día.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {ranges.map((r, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={r.start}
                            onChange={(e) => setRange(day, i, { start: e.target.value })}
                            className="h-10 flex-1 rounded-lg border border-slate-200 px-2 text-sm"
                          />
                          <span className="text-sm text-slate-500">–</span>
                          <input
                            type="time"
                            value={r.end}
                            onChange={(e) => setRange(day, i, { end: e.target.value })}
                            className="h-10 flex-1 rounded-lg border border-slate-200 px-2 text-sm"
                          />
                          <Button type="button" size="sm" variant="outline" onClick={() => removeRange(day, i)} className="border-red-200 text-red-600 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-xs text-slate-500">
            <p className="font-medium text-slate-700">Resumen:</p>
            {(() => {
              const lines = formatScheduleLines(entries);
              if (lines.length === 0) return <p>Sin horarios</p>;
              return (
                <ul className="mt-1 space-y-0.5">
                  {lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              );
            })()}
          </div>

          <Button type="submit" disabled={guardando} className="h-11 w-full bg-blue-600 hover:bg-blue-700">
            {guardando ? "Guardando…" : "Guardar disponibilidad"}
          </Button>
        </form>
      </div>
    </div>
  );
}
