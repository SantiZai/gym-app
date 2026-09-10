"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Dumbbell, Flame, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useExerciseHistory, usePersonalRecords, useProgressOverview, useTrainedExercises, useVolumeHistory } from "@/hooks/useProgress";
import type { ExerciseMetricKey, ProgressRangeKey } from "@/types/progress";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { ExerciseProgress } from "@/components/progreso/ExerciseProgress";
import { MuscleChart } from "@/components/progreso/MuscleChart";
import { RecordsList } from "@/components/progreso/RecordsList";
import { ShareProgress } from "@/components/progreso/ShareProgress";
import { TrainingCalendar } from "@/components/progreso/TrainingCalendar";
import { StreakCard } from "@/components/progreso/StreakCard";
import { VolumeChart } from "@/components/progreso/VolumeChart";
import { cn } from "cn";

const RANGES: { key: ProgressRangeKey; label: string }[] = [
  { key: "30d", label: "30 días" },
  { key: "90d", label: "90 días" },
  { key: "all", label: "Todo" },
];

type TabKey = "ejercicio" | "musculos" | "records" | "calendario";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ejercicio", label: "Por ejercicio" },
  { key: "musculos", label: "Músculos" },
  { key: "records", label: "Récords" },
  { key: "calendario", label: "Calendario" },
];

export default function ProgresoPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [range, setRange] = useState<ProgressRangeKey>("90d");
  const [tab, setTab] = useState<TabKey>("ejercicio");
  const [metric, setMetric] = useState<ExerciseMetricKey>("e1rm");
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  const userId = user?.id;
  const { data: exercises, loading: loadingExercises } = useTrainedExercises(userId);
  const { data: history, loading: loadingHistory } = useExerciseHistory(userId, selectedExercise, range);
  const { muscles, days, streak, loadingMuscles, loadingActivity } = useProgressOverview(userId, range);
  const { data: volume, loading: loadingVolume } = useVolumeHistory(userId, range);
  const { data: records, loading: loadingRecords } = usePersonalRecords(userId);

  useEffect(() => {
    if (!selectedExercise && exercises.length > 0) setSelectedExercise(exercises[0].id);
  }, [exercises, selectedExercise]);

  const summary = useMemo(() => {
    const totalSessions = days.reduce((acc, d) => acc + d.count, 0);
    return {
      totalSessions,
      activeDays: days.length,
      currentStreak: streak?.current ?? 0,
      bestStreak: streak?.best ?? 0,
    };
  }, [days, streak]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <EmptyState
            title="Inicia sesión para ver tu progreso"
            description="Tus gráficos, racha y calendario aparecen cuando entrenas con tu cuenta."
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
          title="Mi progreso"
          description="Evolución por ejercicio, zonas musculares, récords, calendario y racha."
          action={
            <div className="flex items-center gap-2">
              <ShareProgress
                streak={streak}
                records={records}
                totalSessions={summary.totalSessions}
                activeDays={summary.activeDays}
              />
              <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      range === r.key ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Sesiones" value={String(summary.totalSessions)} subtitle="en el historial" icon={Dumbbell} accent="blue" />
          <StatCard title="Días activos" value={String(summary.activeDays)} subtitle="días entrenados" icon={CalendarDays} accent="green" />
          <StatCard title="Racha actual" value={`${summary.currentStreak} sem`} subtitle="semanas seguidas" icon={Flame} accent="orange" />
          <StatCard title="Mejor racha" value={`${summary.bestStreak} sem`} subtitle="récord personal" icon={Trophy} accent="purple" />
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === t.key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "ejercicio" && (
          <ExerciseProgress
            exercises={exercises}
            selectedId={selectedExercise}
            onSelect={setSelectedExercise}
            history={history}
            loadingExercises={loadingExercises}
            loadingHistory={loadingHistory}
            metric={metric}
            onMetricChange={setMetric}
          />
        )}

        {tab === "musculos" && <MuscleChart data={muscles} loading={loadingMuscles} />}

        {tab === "records" && (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <VolumeChart data={volume} loading={loadingVolume} />
            </div>
            <div className="lg:col-span-2">
              <RecordsList data={records} loading={loadingRecords} />
            </div>
          </div>
        )}

        {tab === "calendario" && (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <TrainingCalendar userId={userId} days={days} loading={loadingActivity} />
            </div>
            <div className="lg:col-span-2">
              <StreakCard streak={streak} loading={loadingActivity} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
