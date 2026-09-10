"use client";

import type { LucideIcon } from "lucide-react";
import { Dumbbell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon: Icon = Dumbbell, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed border-slate-200">
      <CardContent className="flex flex-col items-center px-6 py-12 text-center">
        <div className="rounded-2xl bg-slate-100 p-3">
          <Icon className="h-8 w-8 text-slate-400" aria-hidden />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
        {description ? <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p> : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
