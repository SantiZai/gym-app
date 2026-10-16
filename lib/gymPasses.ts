import type { PassMode, PassStatus } from "@/types/db";

/** Días de aviso para "por vencer" (inclusive). */
export const PASS_EXPIRING_WITHIN_DAYS = 7;
/** Ventana para considerar una renovación (días después del vencimiento). */
export const PASS_RENEWAL_GRACE_DAYS = 30;

export const PASS_STATUS_LABEL: Record<PassStatus, string> = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  sin_pase: "Sin pase",
};

function toDateOnly(value: string | Date): Date {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  // YYYY-MM-DD (sin hora) → construir local para no correr por timezone
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatDateAR(value: string | null | undefined): string {
  if (!value) return "—";
  const d = toDateOnly(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function diffDays(fromYYYYMMDD: string, toYYYYMMDD: string): number {
  const ms = toDateOnly(toYYYYMMDD).getTime() - toDateOnly(fromYYYYMMDD).getTime();
  return Math.round(ms / 86400000);
}

export function todayLocalYYYYMMDD(d = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function lastDayOfMonthYYYYMMDD(year: number, month1to12: number): string {
  const last = new Date(year, month1to12, 0).getDate();
  const mm = String(month1to12).padStart(2, "0");
  return `${year}-${mm}-${String(last).padStart(2, "0")}`;
}

/** Calcula vigencia según metodología del gym. paidOn: YYYY-MM-DD. */
export function computePassPeriod(
  paidOnYYYYMMDD: string,
  mode: PassMode,
  days: number
): { start: string; end: string } {
  const paid = toDateOnly(paidOnYYYYMMDD);
  if (mode === "calendar") {
    const y = paid.getFullYear();
    const m = paid.getMonth() + 1;
    const mm = String(m).padStart(2, "0");
    return { start: `${y}-${mm}-01`, end: lastDayOfMonthYYYYMMDD(y, m) };
  }
  const safeDays = Math.min(365, Math.max(1, Math.floor(days) || 30));
  const end = new Date(paid);
  end.setDate(end.getDate() + (safeDays - 1));
  return { start: todayLocalYYYYMMDD(paid), end: todayLocalYYYYMMDD(end) };
}

/** Estado del pase dada la última fecha de fin (null = nunca pagó). */
export function getPassStatus(
  lastEndYYYYMMDD: string | null | undefined,
  todayYYYYMMDD = todayLocalYYYYMMDD(),
  expiringWithin = PASS_EXPIRING_WITHIN_DAYS
): PassStatus {
  if (!lastEndYYYYMMDD) return "sin_pase";
  const remaining = diffDays(todayYYYYMMDD, lastEndYYYYMMDD);
  if (remaining < 0) return "vencido";
  if (remaining <= expiringWithin) return "por_vencer";
  return "vigente";
}

export function daysRemaining(
  lastEndYYYYMMDD: string | null | undefined,
  todayYYYYMMDD = todayLocalYYYYMMDD()
): number | null {
  if (!lastEndYYYYMMDD) return null;
  return diffDays(todayYYYYMMDD, lastEndYYYYMMDD);
}

export interface PassClientRow {
  key: string; // user:<id> | manual:<id>
  kind: "member" | "manual";
  userId: string | null;
  manualId: string | null;
  name: string;
  avatarUrl: string | null;
  lastEnd: string | null;
  lastPaidOn: string | null;
  lastAmount: number | null;
  paymentsCount: number;
  status: PassStatus;
  remaining: number | null;
}

export interface PassMetrics {
  total: number;
  vigentes: number;
  porVencer: number;
  vencidos: number;
  sinPase: number;
  cobrosMes: number;
  montoMes: number;
  /** % que pagó este mes habiendo pagado el anterior (0-100). Null si no hay base. */
  retencionMensual: number | null;
  /** % de vencidos (últimos 60d) que renovaron dentro de 30d. Null si no hay base. */
  renovacion60d: number | null;
}

function monthKey(yyyyMMDD: string): string {
  return yyyyMMDD.slice(0, 7);
}

function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Métricas de caja y retención puras (testeables). */
export function computePassMetrics(
  clients: PassClientRow[],
  payments: { clientKey: string; paid_on: string; period_end: string; amount: number | null }[],
  todayYYYYMMDD = todayLocalYYYYMMDD()
): PassMetrics {
  const total = clients.length;
  const vigentes = clients.filter((c) => c.status === "vigente").length;
  const porVencer = clients.filter((c) => c.status === "por_vencer").length;
  const vencidos = clients.filter((c) => c.status === "vencido").length;
  const sinPase = clients.filter((c) => c.status === "sin_pase").length;

  const curMonth = monthKey(todayYYYYMMDD);
  const prevMonth = prevMonthKey(curMonth);
  const monthPayments = payments.filter((p) => monthKey(p.paid_on) === curMonth);
  const cobrosMes = monthPayments.length;
  const montoMes = monthPayments.reduce((acc, p) => acc + (p.amount ?? 0), 0);

  const paidPrev = new Set(payments.filter((p) => monthKey(p.paid_on) === prevMonth).map((p) => p.clientKey));
  const paidCur = new Set(payments.filter((p) => monthKey(p.paid_on) === curMonth).map((p) => p.clientKey));
  let retencionMensual: number | null = null;
  if (paidPrev.size > 0) {
    let renewed = 0;
    for (const k of paidPrev) if (paidCur.has(k)) renewed++;
    retencionMensual = Math.round((renewed / paidPrev.size) * 100);
  }

  // Renovación: vencimientos en últimos 60d que tuvieron un pago dentro de 30d post-vencimiento
  const today = toDateOnly(todayYYYYMMDD).getTime();
  const sixtyAgo = today - 60 * 86400000;
  const byClient = new Map<string, { paid_on: string; period_end: string }[]>();
  for (const p of payments) {
    const list = byClient.get(p.clientKey) ?? [];
    list.push({ paid_on: p.paid_on, period_end: p.period_end });
    byClient.set(p.clientKey, list);
  }
  let expiredBase = 0;
  let renewedCount = 0;
  for (const [, list] of byClient) {
    const sorted = [...list].sort((a, b) => (a.period_end < b.period_end ? -1 : 1));
    for (let i = 0; i < sorted.length; i++) {
      const endMs = toDateOnly(sorted[i].period_end).getTime();
      if (endMs < sixtyAgo || endMs > today) continue;
      // ¿hay un pago posterior dentro de 30 días del vencimiento?
      const renewed = sorted.some(
        (q, j) =>
          j !== i &&
          toDateOnly(q.paid_on).getTime() > endMs &&
          toDateOnly(q.paid_on).getTime() <= endMs + PASS_RENEWAL_GRACE_DAYS * 86400000
      );
      // También cuenta si el siguiente período pisa el vencimiento (pago anticipado del mes calendario)
      expiredBase++;
      if (renewed) renewedCount++;
    }
  }
  const renovacion60d = expiredBase > 0 ? Math.round((renewedCount / expiredBase) * 100) : null;

  return { total, vigentes, porVencer, vencidos, sinPase, cobrosMes, montoMes, retencionMensual, renovacion60d };
}
