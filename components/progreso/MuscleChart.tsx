"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { MUSCLE_GROUP_COLORS } from "@/lib/muscleGroups";
import { ChartCard } from "@/components/shared/ChartCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import type { MuscleSlice } from "@/types/progress";

export function MuscleChart({ data, loading }: { data: MuscleSlice[]; loading: boolean }) {
  const total = useMemo(() => data.reduce((acc, d) => acc + d.series, 0), [data]);

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
    <ChartCard title="Zonas musculares" description={`${total} series en el período`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="series" nameKey="group" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {data.map((d) => (
                  <Cell key={d.group} fill={MUSCLE_GROUP_COLORS[d.group as keyof typeof MUSCLE_GROUP_COLORS] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value} series`, String(name)]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-2.5">
          {data.map((d) => {
            const pct = total > 0 ? Math.round((d.series / total) * 100) : 0;
            const color = MUSCLE_GROUP_COLORS[d.group as keyof typeof MUSCLE_GROUP_COLORS] ?? "#94a3b8";
            return (
              <li key={d.group}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                    {d.group}
                  </span>
                  <span className="text-slate-500">
                    {d.series} series · {pct}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </ChartCard>
  );
}
