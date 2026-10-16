import { describe, expect, it } from "vitest";
import {
  computePassMetrics,
  computePassPeriod,
  getPassStatus,
} from "./gymPasses";

describe("gymPasses", () => {
  it("rolling 30 días corridos es inclusivo", () => {
    expect(computePassPeriod("2026-10-01", "rolling", 30)).toEqual({
      start: "2026-10-01",
      end: "2026-10-30",
    });
  });

  it("calendar va del 1º a fin de mes", () => {
    expect(computePassPeriod("2026-10-15", "calendar", 30)).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(computePassPeriod("2026-02-10", "calendar", 30).end).toBe("2026-02-28");
  });

  it("estados vigente/por vencer/vencido/sin pase", () => {
    expect(getPassStatus(null, "2026-10-16")).toBe("sin_pase");
    expect(getPassStatus("2026-11-30", "2026-10-16")).toBe("vigente");
    expect(getPassStatus("2026-10-20", "2026-10-16")).toBe("por_vencer");
    expect(getPassStatus("2026-10-15", "2026-10-16")).toBe("vencido");
  });

  it("métricas y retención mensual", () => {
    const clients = [
      { key: "a", status: "vigente" },
      { key: "b", status: "vencido" },
    ] as never;
    const payments = [
      { clientKey: "a", paid_on: "2026-09-05", period_end: "2026-09-30", amount: 10000 },
      { clientKey: "a", paid_on: "2026-10-05", period_end: "2026-10-31", amount: 10000 },
      { clientKey: "b", paid_on: "2026-09-05", period_end: "2026-09-30", amount: 10000 },
    ];
    const m = computePassMetrics(clients, payments, "2026-10-16");
    expect(m.cobrosMes).toBe(1);
    expect(m.montoMes).toBe(10000);
    expect(m.retencionMensual).toBe(50);
  });
});
