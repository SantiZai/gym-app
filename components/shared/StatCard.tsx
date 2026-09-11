"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  accent?: "blue" | "green" | "purple" | "orange";
  className?: string;
  /** Versión densa para grillas 2x2 */
  compact?: boolean;
}

const ACCENTS: Record<NonNullable<StatCardProps["accent"]>, string> = {
  blue: "bg-blue-100 text-blue-600",
  green: "bg-green-100 text-green-600",
  purple: "bg-purple-100 text-purple-600",
  orange: "bg-orange-100 text-orange-600",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "blue",
  className,
  compact = false,
}: StatCardProps) {
  return (
    <Card className={cn("border-slate-200 shadow-sm", className)}>
      <CardContent className={cn("flex items-center gap-4 p-5", compact && "gap-3 p-3")}>
        <div className={cn("rounded-xl p-3", ACCENTS[accent], compact && "rounded-lg p-2")}>
          <Icon className={cn("h-6 w-6", compact && "h-5 w-5")} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{title}</p>
          <p className={cn("truncate text-2xl font-bold text-slate-900", compact && "text-xl")}>{value}</p>
          {subtitle && !compact ? (
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
