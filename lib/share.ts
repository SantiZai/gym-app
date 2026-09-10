import type { PersonalRecord, StreakInfo } from "@/types/progress";

interface ShareInput {
  streak: StreakInfo | null;
  records: PersonalRecord[];
  totalSessions: number;
  activeDays: number;
}

export function buildShareText({ streak, records, totalSessions, activeDays }: ShareInput): string {
  const lines = ["🏋️ Mi progreso en DiaUno"];

  if (streak && (streak.current > 0 || streak.best > 0)) {
    lines.push(`🔥 Racha: ${streak.current} ${streak.current === 1 ? "semana seguida" : "semanas seguidas"} (récord: ${streak.best})`);
  }

  lines.push(`💪 ${totalSessions} ${totalSessions === 1 ? "sesión" : "sesiones"} · ${activeDays} ${activeDays === 1 ? "día activo" : "días activos"}`);

  const top = records.slice(0, 3);
  if (top.length > 0) {
    lines.push("🏆 Marcas:");
    for (const pr of top) {
      lines.push(`• ${pr.name}: ${pr.bestE1rm} kg (1RM est.)`);
    }
  }

  return lines.join("\n");
}
