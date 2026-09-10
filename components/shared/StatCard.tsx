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
}: StatCardProps) {
  return (
    <Card className={cn("border-slate-200 shadow-sm", className)}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("rounded-xl p-3", ACCENTS[accent])}>
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{title}</p>
          <p className="truncate text-2xl font-bold text-slate-900">{value}</p>
          {subtitle ? (
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
