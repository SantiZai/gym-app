import { createClient } from "./supabase/client";
import { supabaseErrorMessage } from "./gymUtils";
import type {
  GymManualClient,
  GymPassPayment,
  PassMode,
} from "@/types/db";

function throwSupabase(error: unknown, fallback: string): never {
  throw new Error(supabaseErrorMessage(error, fallback));
}

export interface PassConfig {
  mode: PassMode;
  days: number;
  defaultAmount: number | null;
}

export async function getPassConfig(gymId: string): Promise<PassConfig> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gyms")
    .select("pass_mode,pass_days,pass_default_amount")
    .eq("id", gymId)
    .single();
  if (error) {
    // Si aún no se corrió la migración, defaultear sin romper la UI
    if (String((error as { code?: string }).code) === "42703") {
      return { mode: "rolling", days: 30, defaultAmount: null };
    }
    // Columna nueva aún no existe (migración vieja): reintentar sin ella
    const retry = await supabase.from("gyms").select("pass_mode,pass_days").eq("id", gymId).single();
    if (!retry.error) {
      const row = retry.data as { pass_mode: string | null; pass_days: number | null };
      return {
        mode: row.pass_mode === "calendar" ? "calendar" : "rolling",
        days: typeof row.pass_days === "number" && row.pass_days >= 1 ? row.pass_days : 30,
        defaultAmount: null,
      };
    }
    throwSupabase(error, "No se pudo cargar la configuración del pase");
  }
  const row = data as { pass_mode: string | null; pass_days: number | null; pass_default_amount: number | string | null };
  const amount = row.pass_default_amount == null ? null : Number(row.pass_default_amount);
  return {
    mode: row.pass_mode === "calendar" ? "calendar" : "rolling",
    days: typeof row.pass_days === "number" && row.pass_days >= 1 ? row.pass_days : 30,
    defaultAmount: amount != null && Number.isFinite(amount) && amount >= 0 ? amount : null,
  };
}

export async function updatePassConfig(gymId: string, mode: PassMode, days: number, defaultAmount: number | null) {
  const supabase = await createClient();
  // RPC (valida owner/admin). Fallback a update directo si el RPC aún no existe.
  const { error } = await supabase.rpc("update_gym_pass_config", {
    p_gym_id: gymId,
    p_mode: mode,
    p_days: days,
    p_amount: defaultAmount,
  });
  if (error) {
    if (String(error.message ?? "").includes("not found") || String((error as { code?: string }).code) === "42883") {
      const { error: direct } = await supabase
        .from("gyms")
        .update({ pass_mode: mode, ...(mode === "rolling" ? { pass_days: days } : {}) })
        .eq("id", gymId);
      if (direct) throwSupabase(direct, "No se pudo guardar la metodología");
      // Intentar guardar monto por separado (puede fallar si falta la columna)
      if (defaultAmount !== null) {
        await supabase.from("gyms").update({ pass_default_amount: defaultAmount }).eq("id", gymId);
      }
      return;
    }
    // RPC viejo sin p_amount: reintentar sin monto + update directo del monto
    if (String(error.message ?? "").includes("p_amount") || String(error.message ?? "").includes("function")) {
      const { error: retry } = await supabase.rpc("update_gym_pass_config", {
        p_gym_id: gymId,
        p_mode: mode,
        p_days: days,
      } as never);
      if (retry) throwSupabase(retry, "No se pudo guardar la metodología");
      if (defaultAmount !== null) {
        await supabase.from("gyms").update({ pass_default_amount: defaultAmount }).eq("id", gymId);
      }
      return;
    }
    throwSupabase(error, "No se pudo guardar la metodología");
  }
}

export async function getManualClients(gymId: string): Promise<GymManualClient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_manual_clients")
    .select("id,gym_id,name,phone,email,notes,created_by,created_at")
    .eq("gym_id", gymId)
    .order("name", { ascending: true })
    .limit(500);
  if (error) {
    if (String((error as { code?: string }).code) === "42P01") return [];
    throwSupabase(error, "No se pudieron cargar los clientes manuales");
  }
  return (data ?? []) as GymManualClient[];
}

export async function createManualClient(
  gymId: string,
  payload: { name: string; phone?: string | null; email?: string | null; notes?: string | null }
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_gym_manual_client", {
    p_gym_id: gymId,
    p_name: payload.name.trim(),
    p_phone: payload.phone?.trim() || null,
    p_email: payload.email?.trim() || null,
    p_notes: payload.notes?.trim() || null,
  });
  if (error) throwSupabase(error, "No se pudo crear el cliente");
  return data as string;
}

export async function getPassPayments(gymId: string): Promise<GymPassPayment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_pass_payments")
    .select("id,gym_id,user_id,manual_client_id,client_name,amount,paid_on,period_start,period_end,notes,created_by,created_at")
    .eq("gym_id", gymId)
    .order("paid_on", { ascending: false })
    .limit(2000);
  if (error) {
    if (String((error as { code?: string }).code) === "42P01") return [];
    // Columna client_name aún no existe (migración caja pendiente): reintentar sin ella
    if (String((error as { code?: string }).code) === "42703") {
      const retry = await supabase
        .from("gym_pass_payments")
        .select("id,gym_id,user_id,manual_client_id,amount,paid_on,period_start,period_end,notes,created_by,created_at")
        .eq("gym_id", gymId)
        .order("paid_on", { ascending: false })
        .limit(2000);
      if (retry.error) throwSupabase(retry.error, "No se pudieron cargar los cobros");
      return ((retry.data ?? []) as Omit<GymPassPayment, "client_name">[]).map((p) => ({
        ...p,
        client_name: null,
      }));
    }
    throwSupabase(error, "No se pudieron cargar los cobros");
  }
  return (data ?? []) as GymPassPayment[];
}

/** Nombres para pagos de ex-miembros (ya no están en gym_members). */
export async function getPassProfileMap(userIds: string[]): Promise<Map<string, { name: string; avatar_url: string | null }>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.from("public_profiles").select("id,name,avatar_url").in("id", unique);
  if (error) return new Map();
  return new Map(((data ?? []) as { id: string; name: string | null; avatar_url: string | null }[]).map((p) => [String(p.id), { name: p.name || "Usuario", avatar_url: p.avatar_url ?? null }]));
}

export async function registerPassPayment(
  gymId: string,
  payload: {
    userId?: string | null;
    manualId?: string | null;
    amount?: number | null;
    paidOn: string; // YYYY-MM-DD
    notes?: string | null;
  }
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_gym_pass_payment", {
    p_gym_id: gymId,
    p_user_id: payload.userId ?? null,
    p_manual_client_id: payload.manualId ?? null,
    p_amount: payload.amount ?? null,
    p_paid_on: payload.paidOn,
    p_notes: payload.notes?.trim() || null,
  });
  if (error) throwSupabase(error, "No se pudo registrar el cobro");
  return data as string;
}

export async function deletePassPayment(paymentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_gym_pass_payment", { p_payment_id: paymentId });
  if (error) throwSupabase(error, "No se pudo eliminar el cobro");
}

export async function deleteManualClient(clientId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_gym_manual_client", { p_client_id: clientId });
  if (error) {
    // Fallback a delete directo (RLS manager lo permite)
    if (String((error as { code?: string }).code) === "42883") {
      const { error: direct } = await supabase.from("gym_manual_clients").delete().eq("id", clientId);
      if (direct) throwSupabase(direct, "No se pudo eliminar el cliente");
      return;
    }
    throwSupabase(error, "No se pudo eliminar el cliente");
  }
}
