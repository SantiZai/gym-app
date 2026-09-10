"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { MUSCLE_GROUP_COLORS } from "@/lib/muscleGroups";
import { ChartCard } from "@/components/shared/ChartCard";
import { MinimalTooltip } from "@/components/progreso/ChartTooltip";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import type { MuscleSlice } from "@/types/progress";

function groupColor(group: string): string {
  return MUSCLE_GROUP_COLORS[group as keyof typeof MUSCLE_GROUP_COLORS] ?? "#94a3b8";
}

export function MuscleChart({ data, loading }: { data: MuscleSlice[]; loading: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const total = useMemo(() => data.reduce((acc, d) => acc + d.series, 0), [data]);
  const active = useMemo(() => data.find((d) => d.group === selected) ?? null, [data, selected]);
  const activePct = active && total > 0 ? Math.round((active.series / total) * 100) : 0;

  const toggle = (group: string) => setSelected((prev) => (prev === group ? null : group));

  if (loading) {
    return (
      <ChartCard title="Zonas musculares" description="Distribución de tu trabajo">
        <Skeleton className="h-[280px] w-full" />
      </ChartCard>
    );
  }

  if (data.length === 0) {
    return (
      <ChartCard title="Zonas musculares" description="Distribución de tu trabajo">
        <EmptyState
          title="Sin datos musculares"
          description="Cuando completes series, vas a ver qué zonas trabajas más y detectar desbalances."
        />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Zonas musculares" description={`${total} series en el período · tocá para detallar`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="series"
                nameKey="group"
                innerRadius={64}
                outerRadius={100}
                paddingAngle={4}
                strokeWidth={0}
                onClick={(_: unknown, index: number) => toggle(data[index].group)}
                className="outline-none"
              >
                {data.map((d) => (
                  <Cell
                    key={d.group}
                    fill={groupColor(d.group)}
                    opacity={!selected || selected === d.group ? 1 : 0.3}
                    className="cursor-pointer transition-opacity"
                  />
                ))}
              </Pie>
              <Tooltip
                content={
                  <MinimalTooltip
                    format={(value, name) => {
                      const slice = data.find((d) => d.group === String(name));
                      const pct = slice && total > 0 ? Math.round((slice.series / total) * 100) : 0;
                      return [`${value} series · ${pct}%`, ""];
                    }}
                  />
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {active ? `${activePct}%` : total}
            </p>
            <p className="max-w-[120px] truncate text-xs text-slate-500">
              {active ? active.group : "series"}
            </p>
          </div>
        </div>
        <ul className="space-y-1">
          {data.map((d) => {
            const pct = total > 0 ? Math.round((d.series / total) * 100) : 0;
            const color = groupColor(d.group);
            const isActive = selected === d.group;
            return (
              <li key={d.group}>
                <button
                  type="button"
                  onClick={() => toggle(d.group)}
                  aria-pressed={isActive}
                  className={cn(
                    "w-full rounded-xl px-2 py-1.5 text-left transition-colors",
                    isActive ? "bg-slate-100" : "hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                      {d.group}
                    </span>
                    <span className="text-slate-500 tabular-nums">
                      {d.series} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartCard>
  );
}
