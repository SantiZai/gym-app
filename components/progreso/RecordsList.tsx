"use client";

import { Medal, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import type { PersonalRecord } from "@/types/progress";
import { cn } from "cn";

function rankStyle(i: number): string {
  if (i === 0) return "bg-amber-100 text-amber-700";
  if (i === 1) return "bg-slate-200 text-slate-600";
  if (i === 2) return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-500";
}

export function RecordsList({ data, loading }: { data: PersonalRecord[]; loading: boolean }) {
  if (loading) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Marcas personales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Marcas personales</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Sin marcas todavía"
            description="Tu mejor 1RM estimado por ejercicio va a aparecer acá."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" aria-hidden />
          Marcas personales
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-slate-100">
          {data.slice(0, 10).map((pr, i) => (
            <li key={pr.exerciseId} className="flex items-center gap-3 py-3">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", rankStyle(i))}>
                {i < 3 ? <Medal className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{pr.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {pr.bestWeight != null && pr.bestReps != null
                    ? `${pr.bestWeight} kg × ${pr.bestReps}`
                    : "—"}
                  {" · "}
                  {new Date(pr.achievedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-bold text-slate-900">{pr.bestE1rm} kg</p>
                <p className="text-[11px] text-slate-500">1RM est.</p>
              </div>
            </li>
          ))}
        </ul>
        {data.length > 10 && (
          <p className="pt-2 text-center text-xs text-slate-500">+ {data.length - 10} ejercicios más</p>
        )}
      </CardContent>
    </Card>
  );
}
