import type { Muscle } from "react-body-highlighter";
import { GROUP_SLUES, intensityLevel } from "@/lib/bodyMap";
import type { MuscleGroup } from "@/lib/muscleGroups";
import type { DaySessionDetail, MuscleSlice } from "@/types/progress";

/** Tamaño de la imagen compartida (retrato, ideal para historias/WhatsApp). */
export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1350;

export interface ShareModelDatum {
  name: string;
  muscles: Muscle[];
  frequency: number;
}

/** Misma transformación que BodyMap: rejas por grupo → datos del highlighter. */
export function toShareModelData(muscles: MuscleSlice[]): ShareModelDatum[] {
  const maxSeries = Math.max(0, ...muscles.map((m) => m.series));
  return muscles
    .map((m) => ({
      name: m.group,
      muscles: GROUP_SLUES[m.group as MuscleGroup] ?? [],
      frequency: intensityLevel(maxSeries > 0 ? m.series / maxSeries : 0),
    }))
    .filter((d) => d.frequency > 0 && d.muscles.length > 0);
}

/** Top de zonas por series (ya vienen ordenadas del query, se reordena por seguridad). */
export function topMuscleGroups(muscles: MuscleSlice[], n = 3): MuscleSlice[] {
  return [...muscles]
    .filter((m) => m.series > 0)
    .sort((a, b) => b.series - a.series)
    .slice(0, n);
}

/** "2026-09-10" → "10 sept". Sin dependencias, funciona también en canvas. */
export function formatDayMonth(dayKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dayKey);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(dayKey);
  if (Number.isNaN(d.getTime())) return dayKey;
  const fmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
  return fmt.format(d).replace(".", "");
}

export interface LastSessionSummary {
  title: string;
  dateKey: string;
  sessionsCount: number;
  exercisesCount: number;
  seriesCount: number;
  volume: number;
}

/** Agrega las sesiones de un día en un resumen para la imagen. */
export function summarizeSessions(details: DaySessionDetail[]): LastSessionSummary | null {
  if (details.length === 0) return null;
  const names = [...new Set(details.map((d) => d.routineName).filter(Boolean))];
  return {
    title: details.length === 1 ? details[0].routineName : `${details.length} sesiones`,
    dateKey: details[0].date.slice(0, 10),
    sessionsCount: details.length,
    exercisesCount: details.reduce((acc, d) => acc + d.exercisesCount, 0),
    seriesCount: details.reduce((acc, d) => acc + d.seriesCount, 0),
    volume: details.reduce((acc, d) => acc + d.volume, 0),
    ...(names.length > 1 ? { title: names.slice(0, 2).join(" + ") } : {}),
  };
}

/** Serializa un <svg> del DOM a HTMLImageElement listo para dibujar en canvas. */
export function svgElementToImage(svg: SVGSVGElement, targetWidth = 600): Promise<HTMLImageElement> {
  const rect = svg.getBoundingClientRect();
  const aspect = rect.height > 0 && rect.width > 0 ? rect.height / rect.width : 2;
  const w = targetWidth;
  const h = Math.round(targetWidth * aspect);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo rasterizar el mapa corporal"));
    };
    img.src = url;
  });
}

export interface ShareImageData {
  userName: string;
  periodLabel: string;
  streakCurrent: number;
  streakBest: number;
  totalSessions: number;
  topMuscles: MuscleSlice[];
  lastSession: LastSessionSummary | null;
  frontImg: HTMLImageElement | null;
  backImg: HTMLImageElement | null;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dibuja imagen dentro de una caja manteniendo aspecto (contain). */
function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";

/** Compone la imagen de progreso y la devuelve como PNG Blob. */
export async function renderShareImage(data: ShareImageData): Promise<Blob> {
  const W = SHARE_IMAGE_WIDTH;
  const H = SHARE_IMAGE_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");

  // Fondo: gradiente azul noche de marca
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1530");
  bg.addColorStop(0.55, "#0f172a");
  bg.addColorStop(1, "#172554");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Barra superior de marca
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(0, 0, W, 14);

  // Encabezado
  ctx.textAlign = "center";
  ctx.fillStyle = "#93c5f4";
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText("H A B I T U S", W / 2, 92);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 72px ${FONT}`;
  ctx.fillText("Mi progreso", W / 2, 172);
  ctx.fillStyle = "#94a3b8";
  ctx.font = `400 30px ${FONT}`;
  const subtitle = data.userName ? `${data.userName} · ${data.periodLabel}` : data.periodLabel;
  ctx.fillText(subtitle, W / 2, 220);

  // Cuerpos frente / espalda
  const bodyY = 280;
  const bodyH = 560;
  const colW = W / 2;
  const labels: [HTMLImageElement | null, string][] = [
    [data.frontImg, "FRENTE"],
    [data.backImg, "ESPALDA"],
  ];
  labels.forEach(([img, label], i) => {
    const cx = colW * i + colW / 2;
    if (img) {
      drawContain(ctx, img, colW * i + 70, bodyY, colW - 140, bodyH);
    } else {
      ctx.strokeStyle = "rgba(148,163,184,0.35)";
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 12]);
      roundRectPath(ctx, colW * i + 120, bodyY + 40, colW - 240, bodyH - 80, 32);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = "#64748b";
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(label, cx, bodyY + bodyH + 40);
  });

  let y = bodyY + bodyH + 110;

  // Racha
  const streakText =
    data.streakCurrent > 0 || data.streakBest > 0
      ? `Racha: ${data.streakCurrent} ${data.streakCurrent === 1 ? "semana" : "semanas"} (récord ${data.streakBest})`
      : `${data.totalSessions} ${data.totalSessions === 1 ? "sesión" : "sesiones"} en el historial`;
  ctx.font = `800 44px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`🔥 ${streakText}`, W / 2, y);
  y += 58;

  // Top zonas musculares
  if (data.topMuscles.length > 0) {
    ctx.font = `400 32px ${FONT}`;
    ctx.fillStyle = "#cbd5e1";
    const names = data.topMuscles.map((m) => m.group).join(" · ");
    ctx.fillText(`Zonas más trabajadas: ${names}`, W / 2, y);
    y += 56;
  }

  // Tarjeta última sesión
  if (data.lastSession) {
    const s = data.lastSession;
    const cardX = 90;
    const cardW = W - 180;
    const cardH = 190;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRectPath(ctx, cardX, y, cardW, cardH, 28);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    roundRectPath(ctx, cardX, y, cardW, cardH, 28);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#93c5f4";
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText("ÚLTIMA SESIÓN", W / 2, y + 52);
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(s.title.length > 34 ? `${s.title.slice(0, 33)}…` : s.title, W / 2, y + 108);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `400 30px ${FONT}`;
    const vol = s.volume > 0 ? ` · ${s.volume.toLocaleString("es")} kg` : "";
    ctx.fillText(
      `${formatDayMonth(s.dateKey)} · ${s.exercisesCount} ejercicios · ${s.seriesCount} series${vol}`,
      W / 2,
      y + 156
    );
  }

  // Pie
  ctx.fillStyle = "#64748b";
  ctx.font = `400 26px ${FONT}`;
  ctx.fillText("Entrenamiento con propósito", W / 2, H - 56);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No se pudo generar la imagen");
  return blob;
}
