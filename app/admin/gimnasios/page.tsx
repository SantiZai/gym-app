"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Shield, UserPlus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { approveGymCreator, isAppAdmin, listGymCreatorApprovals, revokeGymCreator } from "@/utils/gymUtils";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AdminGimnasiosPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [approvals, setApprovals] = useState<{ user_id: string; email: string; name: string | null; can_create_gym: boolean; gym_id: string | null }[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChecking(false);
      setIsAdmin(false);
      return;
    }
    isAppAdmin()
      .then(setIsAdmin)
      .catch(() => setIsAdmin(false))
      .finally(() => setChecking(false));
  }, [user, authLoading]);

  const loadList = async () => {
    setLoadingList(true);
    try {
      const data = await listGymCreatorApprovals();
      setApprovals(data);
    } catch {
      // sin permiso o error
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadList();
  }, [isAdmin]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await approveGymCreator(email);
      toast.success(`${email.trim()} habilitado para crear su gimnasio`);
      setEmail("");
      await loadList();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo habilitar");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (targetEmail: string) => {
    setBusy(true);
    try {
      await revokeGymCreator(targetEmail);
      toast.success(`Revocado: ${targetEmail}`);
      await loadList();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo revocar");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-2xl space-y-4 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <Link href="/gimnasios" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <div className="mt-6 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <Shield className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Solo administradores de la plataforma</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Necesitás que tu usuario tenga <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">is_app_admin = true</code> en la tabla users.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Ejecutá en Supabase SQL Editor: <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">UPDATE users SET is_app_admin = true WHERE email = &apos;tu@mail.com&apos;</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-2xl space-y-6 px-4 sm:px-6 lg:px-8">
        <Link href="/gimnasios" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Gimnasios
        </Link>
        <SectionHeader
          title="Admin · Gimnasios"
          description="Habilitá usuarios que solicitaron alta por mail. Luego ellos verán el formulario y al crear quedarán como dueño + profe."
        />

        <form onSubmit={handleApprove} className="flex flex-col gap-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:flex-row">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="usuario.solicitante@mail.com"
            className="flex-1"
            required
          />
          <Button type="submit" disabled={busy || !email.trim()} className="bg-blue-600 hover:bg-blue-700">
            <UserPlus className="h-4 w-4 mr-1.5" />
            {busy ? "Procesando…" : "Habilitar"}
          </Button>
        </form>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Check className="h-4 w-4" />
            Habilitados pendientes ({approvals.length})
          </h3>
          {loadingList ? (
            <Skeleton className="mt-3 h-20 w-full" />
          ) : approvals.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Nadie pendiente. Los habilitados aparecen acá hasta que creen su gimnasio (ahí se consume el permiso).</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {approvals.map((a) => (
                <li key={a.user_id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{a.email}</p>
                    {a.name && <p className="text-xs text-slate-500">{a.name}</p>}
                  </div>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => handleRevoke(a.email)} className="border-red-200 text-red-600 hover:bg-red-50">
                    <X className="h-3.5 w-3.5 mr-1" />
                    Revocar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Flujo: usuario pide alta por mail → vos ponés su email acá y le habilitás → él entra a /gimnasios/nuevo, ve el formulario, crea el gym y queda automáticamente como <span className="font-medium">dueño + profesor</span> de su gimnasio.
        </p>
      </div>
    </div>
  );
}
