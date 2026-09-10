"use client";

import { useRef, useState, type ReactNode, type TouchEvent } from "react";
import { cn } from "cn";

interface SwipeableRowProps {
  /** Acciones que se revelan al deslizar a la izquierda */
  actions: ReactNode;
  /** Ancho en px del panel de acciones (debe coincidir con su contenido) */
  actionsWidth?: number;
  children: ReactNode;
  className?: string;
  /** Controlado: si se pasa, el padre maneja el estado abierto */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Ej: doble click en PC para revelar acciones sin touch */
  onDoubleClick?: () => void;
}

/** Fila deslizable (touch): swipe a la izquierda revela acciones. */
export function SwipeableRow({
  actions,
  actionsWidth = 96,
  children,
  className,
  open: controlledOpen,
  onOpenChange,
  onDoubleClick,
}: SwipeableRowProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);

  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };

  const onTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (startX.current == null) return;
    const delta = e.touches[0].clientX - startX.current;
    const base = open ? -actionsWidth : 0;
    setDx(Math.min(0, Math.max(-actionsWidth, base + delta)));
  };

  const onTouchEnd = () => {
    startX.current = null;
    setOpen(dx < -actionsWidth / 2);
    setDx(0);
  };

  const offset = dx !== 0 ? dx : open ? -actionsWidth : 0;

  return (
    <div
      className={cn("relative overflow-hidden rounded-lg", className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={onDoubleClick}
    >
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width: actionsWidth }}
        onClick={() => setOpen(false)}
      >
        {actions}
      </div>
      <div
        className="relative transition-transform duration-150"
        style={{ transform: `translateX(${offset}px)` }}
        onClick={() => {
          if (open) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
