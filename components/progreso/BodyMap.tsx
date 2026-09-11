"use client";

import { useEffect, useMemo, useState } from "react";
import Model from "react-body-highlighter";
import { useTheme } from "next-themes";
import { ChartCard } from "@/components/shared/ChartCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BODY_BLUE_SCALE,
  GROUP_SLUES,
  groupOfSlug,
  intensityLevel,
  rangeDescription,
} from "@/lib/bodyMap";
import type { MuscleGroup } from "@/lib/muscleGroups";
import type { MuscleSlice, ProgressRangeKey } from "@/types/progress";

interface Props {
  muscles: MuscleSlice[];
  range: ProgressRangeKey;
  loading: boolean;
}

export function BodyMap({ muscles, range, loading }: Props) {
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Al cambiar el período se limpia la selección
  useEffect(() => {
    setSelected(null);
  }, [range, muscles]);

  const maxSeries = useMemo(() => Math.max(0, ...muscles.map((m) => m.series)), [muscles]);

  const modelData = useMemo(
    () =>
      muscles
        .map((m) => ({
          name: m.group,
          muscles: GROUP_SLUES[m.group as MuscleGroup] ?? [],
          frequency: intensityLevel(maxSeries > 0 ? m.series / maxSeries : 0),
        }))
        .filter((d) => d.frequency > 0 && d.muscles.length > 0),
    [muscles, maxSeries]
  );

  const activeSlice = useMemo(
    () => (selected ? muscles.find((m) => m.group === selected) ?? null : null),
    [muscles, selected]
  );

  const handleMuscleClick = ({ muscle }: { muscle: string }) => {
    const group = groupOfSlug(muscle);
    if (!group) return;
    setSelected((prev) => (prev === group ? null : group));
  };

  // Gris acorde al tema para lo no trabajado
  const bodyColor = mounted && resolvedTheme === "dark" ? "#334155" : "#e2e8f0";

  if (loading) {
    return (
      <ChartCard title="Mapa corporal" description="Intensidad por zona muscular">
        <Skeleton className="h-[280px] w-full" />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Mapa corporal" description="Intensidad por zona · tocá un músculo para detallar">
      <div className="mx-auto flex w-full max-w-md items-start justify-center gap-2">
        <div className="min-w-0 flex-1">
          <Model
            type="anterior"
            data={modelData}
            highlightedColors={BODY_BLUE_SCALE}
            bodyColor={bodyColor}
            onClick={handleMuscleClick}
            style={{ width: "100%", maxWidth: 200, margin: "0 auto" }}
          />
          <p className="mt-1 text-center text-xs text-slate-500">Frente</p>
        </div>
        <div className="min-w-0 flex-1">
          <Model
            type="posterior"
            data={modelData}
            highlightedColors={BODY_BLUE_SCALE}
            bodyColor={bodyColor}
            onClick={handleMuscleClick}
            style={{ width: "100%", maxWidth: 200, margin: "0 auto" }}
          />
          <p className="mt-1 text-center text-xs text-slate-500">Espalda</p>
        </div>
      </div>

      {muscles.length === 0 && (
        <p className="mt-2 text-center text-sm text-slate-500">
          Sin entrenos en este período.
        </p>
      )}

      <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-center" aria-live="polite">
        {!selected ? (
          <p className="text-sm text-slate-500">Tocá un músculo para ver cuántas veces lo trabajaste.</p>
        ) : activeSlice ? (
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{activeSlice.group}</span>
            {" · "}
            {activeSlice.sessions} {activeSlice.sessions === 1 ? "sesión" : "sesiones"}
            {" · "}
            {activeSlice.series} series {rangeDescription(range)}
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{selected}</span>
            {" · "}sin entreno {rangeDescription(range)}
          </p>
        )}
      </div>
    </ChartCard>
  );
}
