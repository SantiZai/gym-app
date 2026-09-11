"use client";

import { useMemo, useRef, useState } from "react";
import Model from "react-body-highlighter";
import { Check, Loader2, Share2 } from "lucide-react";
import { buildShareText } from "@/lib/share";
import {
  renderShareImage,
  summarizeSessions,
  svgElementToImage,
  toShareModelData,
  topMuscleGroups,
} from "@/lib/shareImage";
import { BODY_BLUE_SCALE } from "@/lib/bodyMap";
import { getDaySessions } from "@/utils/progressUtils";
import type { MuscleSlice, PersonalRecord, StreakInfo, TrainingDay } from "@/types/progress";

interface Props {
  streak: StreakInfo | null;
  records: PersonalRecord[];
  totalSessions: number;
  activeDays: number;
  muscles: MuscleSlice[];
  days: TrainingDay[];
  userId: string | undefined;
  userName: string;
  periodLabel: string;
}

type Status = "idle" | "generating" | "copied" | "downloaded" | "failed";

export function ShareProgress({
  streak,
  records,
  totalSessions,
  activeDays,
  muscles,
  days,
  userId,
  userName,
  periodLabel,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const hiddenRef = useRef<HTMLDivElement>(null);

  const modelData = useMemo(() => toShareModelData(muscles), [muscles]);

  const resetAfter = (next: Status) => {
    setStatus(next);
    setTimeout(() => setStatus("idle"), 2500);
  };

  const shareTextOnly = async (text: string) => {
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ title: "Mi progreso en Habitus", text });
        return;
      }
      throw new Error("share no disponible");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        resetAfter("copied");
      } catch {
        resetAfter("failed");
      }
    }
  };

  const handleShare = async () => {
    const text = buildShareText({ streak, records, totalSessions, activeDays });
    setStatus("generating");
    try {
      // Info de la última sesión (día más reciente con entreno)
      const lastDay = days.length > 0 ? days[days.length - 1] : null;
      const details = userId && lastDay ? await getDaySessions(userId, lastDay.date) : [];

      // Rasterizar los mismos cuerpos de la app (render oculto)
      const svgs = hiddenRef.current?.querySelectorAll("svg");
      const frontImg = svgs?.[0] ? await svgElementToImage(svgs[0]).catch(() => null) : null;
      const backImg = svgs?.[1] ? await svgElementToImage(svgs[1]).catch(() => null) : null;

      const blob = await renderShareImage({
        userName,
        periodLabel,
        streakCurrent: streak?.current ?? 0,
        streakBest: streak?.best ?? 0,
        totalSessions,
        topMuscles: topMuscleGroups(muscles),
        lastSession: summarizeSessions(details),
        frontImg,
        backImg,
      });

      const file = new File([blob], "habitus-progreso.png", { type: "image/png" });
      const canShareFiles =
        typeof navigator !== "undefined" &&
        "canShare" in navigator &&
        navigator.canShare({ files: [file] });

      if (canShareFiles) {
        await navigator.share({ files: [file], title: "Mi progreso en Habitus", text });
        setStatus("idle");
        return;
      }

      // Fallback: descargar la imagen + copiar el texto
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "habitus-progreso.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Si no hay portapapeles, igual se descargó la imagen
      }
      resetAfter("downloaded");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
        return;
      }
      // Si falla la imagen, compartir solo texto como antes
      await shareTextOnly(text);
    }
  };

  return (
    <>
      <button
        onClick={handleShare}
        disabled={status === "generating"}
        title={
          status === "failed"
            ? "No se pudo compartir"
            : status === "copied"
              ? "¡Copiado!"
              : status === "downloaded"
                ? "¡Imagen descargada!"
                : "Compartir mi progreso como imagen"
        }
        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition-colors hover:text-slate-900 disabled:opacity-60"
      >
        {status === "generating" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : status === "idle" || status === "failed" ? (
          <Share2 className="h-4 w-4" aria-hidden />
        ) : (
          <Check className="h-4 w-4 text-green-600" aria-hidden />
        )}
        {status === "generating"
          ? "Creando…"
          : status === "copied"
            ? "¡Copiado!"
            : status === "downloaded"
              ? "¡Descargada!"
              : status === "failed"
                ? "Error"
                : "Compartir"}
      </button>

      {/* Modelos ocultos: misma fuente que el mapa de la app para rasterizar la imagen */}
      <div ref={hiddenRef} aria-hidden="true" className="pointer-events-none fixed top-0 left-[-10000px] w-[720px]">
        {modelData.length > 0 && (
          <div className="flex">
            <div className="w-[360px]">
              <Model
                type="anterior"
                data={modelData}
                highlightedColors={BODY_BLUE_SCALE}
                bodyColor="#e2e8f0"
                style={{ width: "100%" }}
              />
            </div>
            <div className="w-[360px]">
              <Model
                type="posterior"
                data={modelData}
                highlightedColors={BODY_BLUE_SCALE}
                bodyColor="#e2e8f0"
                style={{ width: "100%" }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
