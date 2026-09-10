"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/shared/ChartCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import type { VolumePoint } from "@/types/progress";

const compact = new Intl.NumberFormat("es-ES", { notation: "compact" });

export function VolumeChart({ data, loading }: { data: VolumePoint[]; loading: boolean }) {
  const chartData = useMemo(
    () =>
      data.map((p) => ({
        date: new Date(`${p.date}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
        fullDate: new Date(`${p.date}T12:00:00`).toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        volume: p.volume,
        sessions: p.sessions,
      })),
    [data]
  );

  const total = useMemo(() => data.reduce((acc, p) => acc + p.volume, 0), [data]);

  if (loading) {
    return (
      <ChartCard title="Volumen en el tiempo" description="Kilos totales movidos por día">
        <Skeleton className="h-[280px] w-full" />
      </ChartCard>
    );
  }

  if (data.length === 0) {
    return (
      <ChartCard title="Volumen en el tiempo" description="Kilos totales movidos por día">
        <EmptyState
          title="Todavía no hay volumen registrado"
          description="Completa sesiones con peso y repeticiones para ver tu trabajo acumulado."
        />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Volumen en el tiempo"
      description={`${compact.format(total)} kg movidos en el período`}
    >
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => compact.format(v)}
            />
            <Tooltip
              labelFormatter={(_, payload) => String(payload?.[0]?.payload?.fullDate ?? "")}
              formatter={(value, name) =>
                name === "volume" ? [`${Number(value).toLocaleString("es-ES")} kg`, "Volumen"] : [value, name]
              }
            />
            <Area type="monotone" dataKey="volume" stroke="#10b981" strokeWidth={2.5} fill="url(#volGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
