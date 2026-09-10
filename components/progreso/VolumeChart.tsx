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
import { MinimalTooltip } from "@/components/progreso/ChartTooltip";
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
      <div className="h-[260px] w-full sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
              tickFormatter={(v: number) => compact.format(v)}
            />
            <Tooltip
              content={
                <MinimalTooltip
                  getTitle={(item) => String(item.payload?.fullDate ?? "")}
                  format={(value, _name, item) => [
                    `${Number(value).toLocaleString("es-ES")} kg`,
                    `${Number(item.payload?.sessions ?? 0)} ses.`,
                  ]}
                />
              }
              cursor={{ stroke: "#94a3b8", strokeOpacity: 0.4 }}
            />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="#10b981"
              strokeWidth={3}
              fill="url(#volGradient)"
              dot={false}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
