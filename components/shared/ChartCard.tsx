"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

interface ChartCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  minHeight?: number;
}

export function ChartCard({ title, description, action, children, className, minHeight = 280 }: ChartCardProps) {
  return (
    <Card className={cn("border-slate-200 shadow-sm", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent>
        <div style={{ minHeight }} className="w-full">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
