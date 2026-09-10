/** Calcula el siguiente valor de un stepper (tolerante a vacío y comas). */
export function stepValue(raw: string, step: number, dir: 1 | -1, min = 0): string {
  const current = parseFloat(raw.replace(",", "."));
  const base = Number.isFinite(current) ? current : 0;
  const next = Math.round((base + dir * step) * 100) / 100;
  return String(Math.max(min, next));
}
