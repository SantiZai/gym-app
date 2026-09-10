"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/shared/ChartCard";
import { MinimalTooltip } from "@/components/progreso/ChartTooltip";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExerciseHistoryPoint, ExerciseMetricKey, TrainedExercise } from "@/types/progress";
import { TrendingUp } from "lucide-react";
import { cn } from "cn";

interface Props {
  exercises: TrainedExercise[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  history: ExerciseHistoryPoint[];
  loadingExercises: boolean;
  loadingHistory: boolean;
  metric: ExerciseMetricKey;
  onMetricChange: (m: ExerciseMetricKey) => void;
}

const METRICS: { key: ExerciseMetricKey; label: string }[] = [
  { key: "e1rm", label: "1RM est." },
  { key: "maxWeight", label: "Peso máx" },
  { key: "volume", label: "Volumen" },
];

function metricValue(p: ExerciseHistoryPoint, metric: ExerciseMetricKey): number | null {
  if (metric === "e1rm") return p.e1rm;
  if (metric === "maxWeight") return p.weight;
  return p.volume;
}

function metricUnit(metric: ExerciseMetricKey): string {
  return metric === "volume" ? "kg" : "kg";
}

export function ExerciseProgress({
  exercises,
  selectedId,
  onSelect,
  history,
  loadingExercises,
  loadingHistory,
  metric,
  onMetricChange,
}: Props) {
  const chartData = useMemo(
    () =>
      history.map((p) => ({
        date: new Date(p.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
        fullDate: new Date(p.date).toLocaleDateString("es-ES"),
        value: metricValue(p, metric),
        weight: p.weight,
        reps: p.reps,
        e1rm: p.e1rm,
      })),
    [history, metric]
  );

  const delta = useMemo(() => {
    const vals = chartData.map((d) => d.value).filter((v): v is number => v != null);
    if (vals.length < 2) return null;
    const first = vals[0];
    const last = vals[vals.length - 1];
    if (!first) return null;
    return { last, pct: ((last - first) / first) * 100 };
  }, [chartData]);

  return (
    <ChartCard
      title="Progreso por ejercicio"
      description="Filtra de a un ejercicio y mira tu evolución"
      action={
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => onMetricChange(m.key)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                metric === m.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    >
      {loadingExercises ? (
        <Skeleton className="h-10 w-full" />
      ) : exercises.length === 0 ? (
        <EmptyState
          title="Todavía no hay ejercicios con datos"
          description="Completa una sesión con series marcadas como hechas y van a aparecer acá."
        />
      ) : (
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Ejercicio</span>
          <select
            value={selectedId ?? ""}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.sessionsCount} sesiones)
              </option>
            ))}
          </select>
        </label>
      )}

      {selectedId && delta && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
          <TrendingUp className={cn("h-4 w-4", delta.pct >= 0 ? "text-green-600" : "text-red-500")} />
          <span className="font-semibold text-slate-900">
            {delta.last} {metricUnit(metric)}
          </span>
          <span className={cn("text-xs font-medium", delta.pct >= 0 ? "text-green-600" : "text-red-500")}>
            {delta.pct >= 0 ? "+" : ""}
            {delta.pct.toFixed(1)}% en el período
          </span>
        </div>
      )}

      {loadingHistory ? (
        <Skeleton className="h-[280px] w-full" />
      ) : !selectedId || chartData.length === 0 ? (
        <EmptyState
          title="Sin suficientes datos"
          description="Registra al menos 2 sesiones de este ejercicio para ver la tendencia."
        />
      ) : (
        <div className="h-[260px] w-full sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: -8 }}>
              <CartesianGrid vertical={false} stroke="#94a3b8" strokeOpacity={0.25} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={48}
                domain={["auto", "auto"]}
              />
              <Tooltip
                content={
                  <MinimalTooltip
                    getTitle={(item) => String(item.payload?.fullDate ?? "")}
                    format={(value) => [`${value} ${metricUnit(metric)}`, ""]}
                  />
                }
                cursor={{ stroke: "#94a3b8", strokeOpacity: 0.4 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 5, fill: "#2563eb", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 7, strokeWidth: 0 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
