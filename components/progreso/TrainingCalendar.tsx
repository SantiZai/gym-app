"use client";

import { useMemo, useState } from "react";
import { Dumbbell } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { ChartCard } from "@/components/shared/ChartCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useDaySessions } from "@/hooks/useProgress";
import { toDayKey } from "@/lib/streak";
import type { TrainingDay } from "@/types/progress";

interface Props {
  userId: string | undefined;
  days: TrainingDay[];
  loading: boolean;
}

export function TrainingCalendar({ userId, days, loading }: Props) {
  const [month, setMonth] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date | undefined>(undefined);

  const trainedDates = useMemo(() => days.map((d) => {
    const [y, m, day] = d.date.split("-").map(Number);
    return new Date(y, m - 1, day);
  }), [days]);

  const trainedSet = useMemo(() => new Set(days.map((d) => d.date)), [days]);

  const selectedKey = selected ? toDayKey(selected) : null;
  const isTrainedDay = selectedKey ? trainedSet.has(selectedKey) : false;
  const { data: detail, loading: loadingDetail } = useDaySessions(userId, isTrainedDay ? selectedKey : null);

  const selectedCount = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    return days.filter((d) => {
      const [dy, dm] = d.date.split("-").map(Number);
      return dy === y && dm === m + 1;
    }).reduce((acc, d) => acc + d.count, 0);
  }, [days, month]);

  const selectedLabel = selected
    ? selected.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
    : null;

  return (
    <ChartCard
      title="Calendario de entrenos"
      description={selectedCount > 0 ? `${selectedCount} sesiones este mes` : "Días entrenados en azul"}
    >
      {loading ? (
        <Skeleton className="h-[320px] w-full" />
      ) : (
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            month={month}
            onMonthChange={setMonth}
            modifiers={{ trained: trainedDates }}
            modifiersStyles={{
              trained: { background: "#2563eb", color: "#fff", borderRadius: 12, fontWeight: 700 },
            }}
            className="rounded-xl border border-slate-200"
          />
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        {!selected || !selectedKey ? (
          <p className="text-center text-sm text-slate-500">
            {days.length === 0
              ? "Todavía no registraste entrenamientos."
              : "Tocá un día azul para ver qué entrenaste."}
          </p>
        ) : !isTrainedDay ? (
          <p className="text-center text-sm text-slate-500">
            <span className="font-medium capitalize text-slate-700">{selectedLabel}</span>
            {" — día de descanso."}
          </p>
        ) : loadingDetail ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : detail.length === 0 ? (
          <p className="text-center text-sm text-slate-500">Sin detalle para este día.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium capitalize text-slate-700">{selectedLabel}</p>
            {detail.map((s) => (
              <div key={s.sessionId} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Dumbbell className="h-4 w-4 text-blue-600" aria-hidden />
                  {s.routineName}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {s.exercisesCount} ejercicios · {s.seriesCount} series
                  {s.volume > 0 ? ` · ${(s.volume / 1000).toFixed(1)} t movidas` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-slate-500">
        {`${days.length} días activos en total.`}
      </p>
    </ChartCard>
  );
}
