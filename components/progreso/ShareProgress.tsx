"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { buildShareText } from "@/lib/share";
import type { PersonalRecord, StreakInfo } from "@/types/progress";

interface Props {
  streak: StreakInfo | null;
  records: PersonalRecord[];
  totalSessions: number;
  activeDays: number;
}

export function ShareProgress({ streak, records, totalSessions, activeDays }: Props) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleShare = async () => {
    const text = buildShareText({ streak, records, totalSessions, activeDays });
    setFailed(false);
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ title: "Mi progreso en GymApp", text });
        return;
      }
      throw new Error("share no disponible");
    } catch (error) {
      // El usuario puede cancelar el diálogo nativo: no es un error
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setFailed(true);
        setTimeout(() => setFailed(false), 2000);
      }
    }
  };

  return (
    <button
      onClick={handleShare}
      title={failed ? "No se pudo compartir" : copied ? "¡Copiado!" : "Compartir mi progreso"}
      className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition-colors hover:text-slate-900"
    >
      {copied ? <Check className="h-4 w-4 text-green-600" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
      {copied ? "¡Copiado!" : failed ? "Error" : "Compartir"}
    </button>
  );
}
