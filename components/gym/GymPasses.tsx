"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  BadgeDollarSign,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  CircleX,
  Plus,
  Receipt,
  Search,
  Settings2,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { FilterSelect } from "@/components/shared/FilterSelect";
import type { GymMemberWithProfile, PassMode } from "@/types/db";
import {
  computePassMetrics,
  computePassPeriod,
  daysRemaining,
  formatDateAR,
  getPassStatus,
  todayLocalYYYYMMDD,
  type PassClientRow,
} from "@/lib/gymPasses";
import {
  createManualClient,
  getManualClients,
  getPassConfig,
  getPassPayments,
  registerPassPayment,
  updatePassConfig,
} from "@/utils/gymPassUtils";
import { toast } from "sonner";
import { cn } from "cn";

interface GymPassesProps {
  gymId: string;
  members: GymMemberWithProfile[];
  brand: string;
  isAdmin: boolean;
  currentUserId: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  vigente: "bg-green-100 text-green-700",
  por_vencer: "bg-amber-100 text-amber-800",
  vencido: "bg-red-100 text-red-700",
  sin_pase: "bg-slate-100 text-slate-600",
};

const STATUS_LABEL: Record<string, string> = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  sin_pase: "Sin pase",
};

export function GymPasses({ gymId, members, brand, isAdmin, currentUserId }: GymPassesProps) {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PassMode>("rolling");
  const [days, setDays] = useState(30);
  const [defaultAmount, setDefaultAmount] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  const [payments, setPayments] = useState<Awaited<ReturnType<typeof getPassPayments>>>([]);
  const [manuals, setManuals] = useState<Awaited<ReturnType<typeof getManualClients>>>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Registrar cobro
  const [showPay, setShowPay] = useState(false);
  const [payClientKey, setPayClientKey] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayLocalYYYYMMDD());
  const [payNotes, setPayNotes] = useState("");
  const [paying, setPaying] = useState(false);

  // Cliente manual
  const [showManual, setShowManual] = useState(false);
  const [mName, setMName] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mEmail, setMEmail] = useState("");
  const [creatingManual, setCreatingManual] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cfg, pays, mans] = await Promise.all([
          getPassConfig(gymId),
          getPassPayments(gymId),
          getManualClients(gymId),
        ]);
        if (!alive) return;
        setMode(cfg.mode);
        setDays(cfg.days);
        setDefaultAmount(cfg.defaultAmount != null ? String(cfg.defaultAmount) : "");
        // Prefill monto si aún no se tocó
        setPayAmount((prev) => (prev === "" && cfg.defaultAmount != null ? String(cfg.defaultAmount) : prev));
        setPayments(pays);
        setManuals(mans);
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar los pases");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [gymId]);

  // Refresco silencioso: actualiza datos sin skeletons ni saltos de scroll
  const refreshSilent = async () => {
    try {
      const [pays, mans] = await Promise.all([getPassPayments(gymId), getManualClients(gymId)]);
      setPayments(pays);
      setManuals(mans);
    } catch (e) {
      console.error(e);
    }
  };

  const clients: PassClientRow[] = useMemo(() => {
    const rows: PassClientRow[] = [];
    const today = todayLocalYYYYMMDD();
    // Uno no es cliente de su propio gym: se excluye a sí mismo (no puede cobrarse)
    const chargeable = members.filter((m) => m.user_id !== currentUserId);
    for (const m of chargeable) {
      const mine = payments
        .filter((p) => p.user_id === m.user_id)
        .sort((a, b) => (a.period_end < b.period_end ? 1 : -1));
      const last = mine[0] ?? null;
      const status = getPassStatus(last?.period_end ?? null, today);
      rows.push({
        key: `user:${m.user_id}`,
        kind: "member",
        userId: m.user_id,
        manualId: null,
        name: m.name,
        avatarUrl: m.avatar_url,
        lastEnd: last?.period_end ?? null,
        lastPaidOn: last?.paid_on ?? null,
        lastAmount: last?.amount ?? null,
        paymentsCount: mine.length,
        status,
        remaining: daysRemaining(last?.period_end ?? null, today),
      });
    }
    for (const mc of manuals) {
      const mine = payments
        .filter((p) => p.manual_client_id === mc.id)
        .sort((a, b) => (a.period_end < b.period_end ? 1 : -1));
      const last = mine[0] ?? null;
      rows.push({
        key: `manual:${mc.id}`,
        kind: "manual",
        userId: null,
        manualId: mc.id,
        name: mc.name,
        avatarUrl: null,
        lastEnd: last?.period_end ?? null,
        lastPaidOn: last?.paid_on ?? null,
        lastAmount: last?.amount ?? null,
        paymentsCount: mine.length,
        status: getPassStatus(last?.period_end ?? null, today),
        remaining: daysRemaining(last?.period_end ?? null, today),
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [members, manuals, payments, currentUserId]);

  const metrics = useMemo(() => {
    const payRows = payments.map((p) => ({
      clientKey: p.user_id ? `user:${p.user_id}` : `manual:${p.manual_client_id}`,
      paid_on: p.paid_on,
      period_end: p.period_end,
      amount: p.amount,
    }));
    return computePassMetrics(clients, payRows);
  }, [clients, payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clients, search, statusFilter]);

  const preview = useMemo(() => {
    if (!payDate) return null;
    try {
      return computePassPeriod(payDate, mode, days);
    } catch {
      return null;
    }
  }, [payDate, mode, days]);

  const handleSaveConfig = async () => {
    if (mode === "rolling" && (days < 1 || days > 365)) {
      toast.error("Los días deben estar entre 1 y 365");
      return;
    }
    const parsedAmount = defaultAmount.trim() === "" ? null : Number(defaultAmount.replace(",", "."));
    if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) {
      toast.error("Monto inválido");
      return;
    }
    setSavingConfig(true);
    try {
      await updatePassConfig(gymId, mode, days, parsedAmount);
      // El próximo cobro arranca con ese valor (editable)
      if (parsedAmount !== null) setPayAmount(String(parsedAmount));
      toast.success(
        mode === "calendar" ? "Pase por mes calendario guardado" : `Pase de ${days} días corridos guardado`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSavingConfig(false);
    }
  };

  const openPayForm = (clientKey = "") => {
    if (clientKey) setPayClientKey(clientKey);
    // Prefill con el monto por defecto si el campo está vacío
    setPayAmount((prev) => (prev === "" && defaultAmount.trim() !== "" ? defaultAmount.trim() : prev));
    setPayDate(todayLocalYYYYMMDD());
    setShowPay(true);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payClientKey) {
      toast.error("Elegí un cliente");
      return;
    }
    const [kind, id] = payClientKey.split(/:(.+)/);
    const amount = payAmount.trim() === "" ? null : Number(payAmount.replace(",", "."));
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      toast.error("Monto inválido");
      return;
    }
    setPaying(true);
    try {
      const newId = await registerPassPayment(gymId, {
        userId: kind === "user" ? id : null,
        manualId: kind === "manual" ? id : null,
        amount,
        paidOn: payDate,
        notes: payNotes || null,
      });
      const start = preview?.start ?? payDate;
      const end = preview?.end ?? payDate;
      // Optimista: actualiza UI en el lugar, sin skeletons ni scroll jump
      const optimisticName = clients.find((c) => c.key === payClientKey)?.name ?? null;
      setPayments((prev) => [
        {
          id: newId,
          gym_id: gymId,
          user_id: kind === "user" ? id : null,
          manual_client_id: kind === "manual" ? id : null,
          client_name: optimisticName,
          amount,
          paid_on: payDate,
          period_start: start,
          period_end: end,
          notes: payNotes || null,
          created_by: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      toast.success(`Cobro registrado (${formatDateAR(start)} al ${formatDateAR(end)})`);
      setShowPay(false);
      setPayClientKey("");
      // Mantiene el default para el próximo cobro rápido
      setPayAmount(defaultAmount.trim() !== "" ? defaultAmount.trim() : "");
      setPayNotes("");
      setPayDate(todayLocalYYYYMMDD());
      // Sincroniza en fondo por si la config cambió en el server
      void refreshSilent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar");
    } finally {
      setPaying(false);
    }
  };

  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mName.trim().length < 2) {
      toast.error("El nombre es requerido");
      return;
    }
    setCreatingManual(true);
    try {
      const newId = await createManualClient(gymId, { name: mName, phone: mPhone || null, email: mEmail || null });
      const trimmed = mName.trim();
      // Optimista: agrega en orden alfabético sin recargar ni mover scroll
      setManuals((prev) =>
        [
          ...prev,
          {
            id: newId,
            gym_id: gymId,
            name: trimmed,
            phone: mPhone.trim() || null,
            email: mEmail.trim() || null,
            notes: null,
            created_by: null,
            created_at: new Date().toISOString(),
          },
        ].sort((a, b) => a.name.localeCompare(b.name, "es"))
      );
      toast.success("Cliente manual creado (solo caja: sin rutinas hasta crear cuenta)");
      setMName("");
      setMPhone("");
      setMEmail("");
      setShowManual(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear");
    } finally {
      setCreatingManual(false);
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
      {/* Config metodología */}
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Metodología del pase (única para el gym)</h3>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_160px_auto]">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setMode("rolling")}
              disabled={!isAdmin}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
                mode === "rolling" ? "text-white shadow-sm" : "text-slate-600 hover:bg-white"
              )}
              style={mode === "rolling" ? { backgroundColor: brand } : undefined}
            >
              Días corridos
            </button>
            <button
              onClick={() => setMode("calendar")}
              disabled={!isAdmin}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
                mode === "calendar" ? "text-white shadow-sm" : "text-slate-600 hover:bg-white"
              )}
              style={mode === "calendar" ? { backgroundColor: brand } : undefined}
            >
              Mes calendario
            </button>
          </div>
          {mode === "rolling" ? (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="whitespace-nowrap">Días</span>
              <Input
                type="number"
                min={1}
                max={365}
                value={days}
                disabled={!isAdmin}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-24"
              />
            </label>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarDays className="h-4 w-4" />
              Pague cuando pague, rige del 1º a fin de mes.
            </p>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">Monto $</span>
            <Input
              inputMode="decimal"
              placeholder="15000"
              value={defaultAmount}
              disabled={!isAdmin}
              onChange={(e) => setDefaultAmount(e.target.value)}
              className="w-28"
            />
          </label>
          {isAdmin ? (
            <Button onClick={handleSaveConfig} disabled={savingConfig} style={{ backgroundColor: brand }} className="text-white">
              {savingConfig ? "Guardando…" : "Guardar"}
            </Button>
          ) : (
            <p className="text-xs text-slate-500">Solo dueño/admin cambian la metodología.</p>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {mode === "rolling"
            ? `Cada cobro dura ${days} días corridos desde el pago (ej: paga hoy, vence en ${days - 1} días más).`
            : "Cada cobro cubre el mes completo donde se paga (del 1º al último día)."}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard compact title="Vigentes" value={String(metrics.vigentes)} icon={CircleCheck} accent="green" />
        <StatCard compact title="Por vencer (7d)" value={String(metrics.porVencer)} icon={CircleAlert} accent="orange" />
        <StatCard compact title="Vencidos" value={String(metrics.vencidos)} icon={CircleX} accent="blue" />
        <StatCard compact title="Sin pase" value={String(metrics.sinPase)} icon={Receipt} accent="purple" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          compact
          title="Retención mes"
          value={metrics.retencionMensual === null ? "—" : `${metrics.retencionMensual}%`}
          subtitle="Pagó este mes habiendo pagado el anterior"
          icon={Wallet}
          accent="green"
        />
        <StatCard
          compact
          title="Renovación 60d"
          value={metrics.renovacion60d === null ? "—" : `${metrics.renovacion60d}%`}
          subtitle="Vencidos que volvieron en 30d"
          icon={BadgeDollarSign}
          accent="blue"
        />
        <StatCard compact title="Cobros mes" value={String(metrics.cobrosMes)} icon={Receipt} accent="purple" />
        <StatCard
          compact
          title="Caja mes"
          value={`$${metrics.montoMes.toLocaleString("es-AR")}`}
          icon={Wallet}
          accent="orange"
        />
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => (showPay ? setShowPay(false) : openPayForm())}
          style={{ backgroundColor: brand }}
          className="text-white"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Registrar cobro
        </Button>
        <Button variant="outline" onClick={() => setShowManual((v) => !v)}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Cliente manual
        </Button>
      </div>

      {showPay && (
        <form onSubmit={handlePay} className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Cliente</span>
              <select
                value={payClientKey}
                onChange={(e) => setPayClientKey(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Elegí…</option>
                {clients.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name} {c.kind === "manual" ? "(manual)" : ""} — {STATUS_LABEL[c.status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">
                Monto cobrado ($) {defaultAmount.trim() !== "" ? "(por defecto, editable)" : ""}
              </span>
              <Input
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                inputMode="decimal"
                placeholder={defaultAmount.trim() !== "" ? defaultAmount.trim() : "15000"}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Fecha de pago</span>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Nota (opcional)</span>
              <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Efectivo / Transf…" />
            </label>
          </div>
          {preview && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              Vigencia: {formatDateAR(preview.start)} al {formatDateAR(preview.end)}{" "}
              {mode === "rolling" ? `(${days} días corridos)` : "(mes calendario)"}
            </p>
          )}
          <Button type="submit" disabled={paying || !payClientKey} style={{ backgroundColor: brand }} className="text-white">
            {paying ? "Guardando…" : "Guardar cobro"}
          </Button>
        </form>
      )}

      {showManual && (
        <form onSubmit={handleManual} className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs text-slate-500">
            Cliente solo para caja y métricas. Sin cuenta no puede ver rutinas: cuando cree su cuenta, agregalo por email en Miembros.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Nombre y apellido *" />
            <Input value={mPhone} onChange={(e) => setMPhone(e.target.value)} placeholder="Teléfono" />
            <Input value={mEmail} onChange={(e) => setMEmail(e.target.value)} type="email" placeholder="Email (opcional)" />
          </div>
          <Button type="submit" disabled={creatingManual} variant="outline">
            {creatingManual ? "Creando…" : "Crear cliente manual"}
          </Button>
        </form>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente…" className="pl-9" />
        </div>
        <div className="w-full sm:w-52">
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            allLabel="Todos los estados"
            options={["vigente", "por_vencer", "vencido", "sin_pase"]}
            labels={STATUS_LABEL}
            ariaLabel="Filtrar por estado del pase"
          />
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Sin clientes en este filtro"
          description="Registrá un cobro o creá un cliente manual para empezar la caja del mes."
          icon={Wallet}
        />
      ) : (
        <div className="divide-y divide-slate-200/60 dark:divide-white/10 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10">
          {filtered.map((c) => (
            <div key={c.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {c.avatarUrl ? (
                <Image
                  src={c.avatarUrl}
                  alt={c.name}
                  width={40}
                  height={40}
                  className="rounded-full object-cover shrink-0"
                  style={{ width: 40, height: 40 }}
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                  {c.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {c.name}{" "}
                  {c.kind === "manual" && (
                    <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">manual</span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {c.lastEnd ? (
                    <>Vigencia al {formatDateAR(c.lastEnd)} · {c.paymentsCount} cobros</>
                  ) : (
                    "Sin cobros registrados"
                  )}
                  {c.remaining !== null && c.remaining >= 0 && c.status !== "sin_pase" && <> · quedan {c.remaining}d</>}
                  {c.remaining !== null && c.remaining < 0 && <> · venció hace {Math.abs(c.remaining)}d</>}
                </p>
              </div>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_BADGE[c.status])}>
                {STATUS_LABEL[c.status]}
              </span>
              <Button size="sm" variant="outline" onClick={() => openPayForm(c.key)}>
                Cobrar
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Los cobros solo se eliminan a mano desde la pestaña Caja. Sacar un miembro no borra su historial.
      </p>
    </div>
  );
}
