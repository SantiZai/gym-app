"use client";

import { Flame, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { StreakInfo } from "@/types/progress";
import { cn } from "cn";

export function StreakCard({ streak, loading }: { streak: StreakInfo | null; loading: boolean }) {
  if (loading || !streak) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Racha semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const last8 = streak.weeks.slice(-8);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" aria-hidden />
          Racha semanal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-orange-50 p-4 text-center">
            <p className="text-3xl font-bold text-orange-600">{streak.current}</p>
            <p className="text-xs font-medium text-orange-700">semanas seguidas</p>
          </div>
          <div className="rounded-2xl bg-slate-100 p-4 text-center">
            <p className="flex items-center justify-center gap-1 text-3xl font-bold text-slate-900">
              <Trophy className="h-5 w-5 text-amber-500" aria-hidden />
              {streak.best}
            </p>
            <p className="text-xs font-medium text-slate-500">mejor racha</p>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">Últimas 8 semanas</p>
          <div className="flex gap-1.5">
            {last8.map((w) => (
              <div
                key={w.weekStart}
                title={`${w.weekStart}: ${w.trained ? "entrenaste" : "sin entreno"}`}
                className={cn(
                  "h-8 flex-1 rounded-lg",
                  w.trained
                    ? "bg-orange-500 ring-2 ring-inset ring-orange-600/40"
                    : "bg-white ring-2 ring-inset ring-slate-300"
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Una semana cuenta si entrenas al menos 1 día (lunes a domingo). La semana actual no rompe la racha.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
