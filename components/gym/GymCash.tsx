"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CalendarDays, Receipt, Search, Trash2, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { FilterSelect } from "@/components/shared/FilterSelect";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { GymMemberWithProfile } from "@/types/db";
import type { DateRange } from "react-day-picker";
import { formatDateAR, todayLocalYYYYMMDD } from "@/lib/gymPasses";
import { deletePassPayment, getManualClients, getPassPayments, getPassProfileMap } from "@/utils/gymPassUtils";
import { toast } from "sonner";

interface GymCashProps {
  gymId: string;
  members: GymMemberWithProfile[];
  brand: string;
}

function toDateOnlyKey(value: string): string {
  return value.slice(0, 10);
}

function rangeToKeys(range: DateRange | undefined): { from: string | null; to: string | null } {
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: range?.from ? fmt(range.from) : null, to: range?.to ? fmt(range.to ?? range.from) : null };
}

const MONTH_LABEL: Record<string, string> = {
  "01": "Enero",
  "02": "Febrero",
  "03": "Marzo",
  "04": "Abril",
  "05": "Mayo",
  "06": "Junio",
  "07": "Julio",
  "08": "Agosto",
  "09": "Septiembre",
  "10": "Octubre",
  "11": "Noviembre",
  "12": "Diciembre",
};

export function GymCash({ gymId, members }: GymCashProps) {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof getPassPayments>>>([]);
  const [manuals, setManuals] = useState<Awaited<ReturnType<typeof getManualClients>>>([]);
  const [profiles, setProfiles] = useState<Map<string, { name: string; avatar_url: string | null }>>(new Map());

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [showCalendar, setShowCalendar] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pays, mans] = await Promise.all([getPassPayments(gymId), getManualClients(gymId)]);
        if (!alive) return;
        setPayments(pays);
        setManuals(mans);
        // Ex-miembros: user_ids en caja que ya no están en members ni manuales
        const currentIds = new Set(members.map((m) => m.user_id));
        const missing = [...new Set(pays.map((p) => p.user_id).filter((id): id is string => !!id && !currentIds.has(id)))];
        if (missing.length > 0) {
          const map = await getPassProfileMap(missing);
          if (alive) setProfiles(map);
        }
      } catch (e) {
        console.error(e);
        toast.error("No se pudo cargar la caja");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [gymId, members]);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const manualMap = useMemo(() => new Map(manuals.map((m) => [m.id, m])), [manuals]);

  const resolveClient = (p: (typeof payments)[number]) => {
    if (p.user_id && memberMap.has(p.user_id)) {
      const m = memberMap.get(p.user_id)!;
      return { name: m.name, avatar: m.avatar_url, tag: null as string | null };
    }
    if (p.manual_client_id && manualMap.has(p.manual_client_id)) {
      return { name: manualMap.get(p.manual_client_id)!.name, avatar: null, tag: "manual" };
    }
    if (p.user_id && profiles.has(p.user_id)) {
      const pr = profiles.get(p.user_id)!;
      return { name: pr.name, avatar: pr.avatar_url, tag: "ex-miembro" };
    }
    if (p.client_name) {
      return { name: p.client_name, avatar: null, tag: p.user_id || p.manual_client_id ? null : "eliminado" };
    }
    return { name: "Cliente", avatar: null, tag: null };
  };

  const years = useMemo(() => {
    const set = new Set(payments.map((p) => toDateOnlyKey(p.paid_on).slice(0, 4)));
    set.add(todayLocalYYYYMMDD().slice(0, 4));
    return [...set].sort().reverse();
  }, [payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const { from, to } = rangeToKeys(range);
    return payments.filter((p) => {
      const day = toDateOnlyKey(p.paid_on);
      if (from && day < from) return false;
      if (to && day > to) return false;
      // Si hay rango personalizado, ignora año/mes
      if (!from) {
        if (year && !day.startsWith(year)) return false;
        if (month && day.slice(5, 7) !== month) return false;
      }
      if (q) {
        const c = resolveClient(p);
        const hay = `${c.name} ${p.notes ?? ""} ${p.amount ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, search, year, month, range, memberMap, manualMap, profiles]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof payments>();
    for (const p of filtered) {
      const day = toDateOnlyKey(p.paid_on);
      const list = map.get(day) ?? [];
      list.push(p);
      map.set(day, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const hasFilters = search.trim() !== "" || year !== "" || month !== "" || range?.from;
  const clearFilters = () => {
    setSearch("");
    setYear("");
    setMonth("");
    setRange(undefined);
    setShowCalendar(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const target = deleteId;
    setDeleting(true);
    try {
      await deletePassPayment(target);
      setPayments((prev) => prev.filter((p) => p.id !== target));
      toast.success("Cobro eliminado");
      setDeleteId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[30%_1fr]">
      <div className="order-2 space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:order-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, nota o monto…" className="pl-9" />
          </div>
          <div className="w-full sm:w-32">
            <FilterSelect value={year} onChange={setYear} allLabel="Todos los años" options={years} ariaLabel="Filtrar por año" />
          </div>
          <div className="w-full sm:w-40">
            <FilterSelect value={month} onChange={setMonth} allLabel="Todos los meses" options={Object.keys(MONTH_LABEL)} labels={MONTH_LABEL} ariaLabel="Filtrar por mes" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCalendar((v) => !v)}>
            <CalendarDays className="mr-1.5 h-4 w-4" />
            {range?.from ? `Del ${formatDateAR(rangeToKeys(range).from)} al ${formatDateAR(rangeToKeys(range).to)}` : "Fecha personalizada"}
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Limpiar
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          El historial se conserva aunque el miembro salga del gym o se borre el cliente manual. Solo se borra desde acá, a mano.
        </p>
      </div>
      <div className="order-1 lg:order-1">
        <StatCard compact title="Cobros" value={String(filtered.length)} icon={Receipt} accent="blue" className="h-full" />
      </div>
      </div>

      {showCalendar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCalendar(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Fecha personalizada"
            className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-slate-900">Fecha personalizada</p>
            <div className="mt-2 flex justify-center">
              <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={1} className="rounded-xl border border-slate-200" />
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setRange(undefined);
                  setShowCalendar(false);
                }}
              >
                Quitar fecha
              </Button>
              <Button className="flex-1 text-white" onClick={() => setShowCalendar(false)}>
                Listo
              </Button>
            </div>
          </div>
        </div>
      )}

      {grouped.length === 0 ? (
        <EmptyState title="Sin cobros en este filtro" description="Probá con otro mes, año o rango de fechas." icon={Wallet} />
      ) : (
        <div className="space-y-3">
          {grouped.map(([day, list]) => {
            const dayTotal = list.reduce((acc, p) => acc + (p.amount ?? 0), 0);
            return (
              <div key={day} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-2">
                  <p className="text-sm font-semibold text-slate-900">{formatDateAR(day)}</p>
                  <p className="text-xs font-medium text-slate-600">
                    {list.length} {list.length === 1 ? "cobro" : "cobros"} · ${dayTotal.toLocaleString("es-AR")}
                  </p>
                </div>
                <div className="divide-y divide-slate-200/60 dark:divide-white/10">
                  {list.map((p) => {
                    const c = resolveClient(p);
                    return (
                      <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        {c.avatar ? (
                          <Image src={c.avatar} alt={c.name} width={36} height={36} className="rounded-full object-cover shrink-0" style={{ width: 36, height: 36 }} />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {c.name}{" "}
                            {c.tag && (
                              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{c.tag}</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            Vigencia {formatDateAR(p.period_start)} al {formatDateAR(p.period_end)}
                            {p.notes ? ` · ${p.notes}` : ""}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {p.amount != null ? `$${Number(p.amount).toLocaleString("es-AR")}` : "—"}
                        </span>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setDeleteId(p.id)} aria-label="Eliminar cobro">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Eliminar cobro"
        description="Se elimina solo este registro de caja. No se puede deshacer."
        confirmLabel="Sí, eliminar"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
