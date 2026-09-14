import { createClient } from "./supabase/client";
import type {
  Gym,
  GymMember,
  GymMemberRole,
  GymMemberWithProfile,
  GymTrainer,
  GymTrainerWithProfile,
  Routine,
  TrainerScheduleEntry,
} from "@/types/db";

export interface GymWithCounts extends Gym {
  membersCount: number;
  routinesCount: number;
  trainersCount: number;
}

export interface CreateGymPayload {
  nombre: string;
  descripcion?: string | null;
  telefono?: string | null;
  email?: string | null;
  instagram?: string | null;
  website?: string | null;
  direccion?: string | null;
  maps_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface UpdateGymPayload {
  name?: string;
  description?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  website?: string | null;
  address?: string | null;
  maps_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// Supabase a veces devuelve errores como objetos planos (sin Error ni message
// enumerable). Esto extrae message/details/hint/code para no mostrar "{}".
export function supabaseErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  const e = error as Record<string, unknown>;
  const parts = [e.message, e.details, e.hint, e.code].filter(
    (p): p is string => typeof p === "string" && p.length > 0
  );
  if (parts.length > 0) return parts.join(" · ");
  try {
    const json = JSON.stringify(e);
    if (json && json !== "{}") return json;
  } catch {
    // ignorar
  }
  return fallback;
}

function throwSupabase(error: unknown, fallback: string): never {
  throw new Error(supabaseErrorMessage(error, fallback));
}

// ---------- Lecturas ----------

const GYM_SELECT = "id,name,description,logo_url,primary_color,phone,email,instagram,website,address,maps_url,latitude,longitude,created_by,created_at";

export interface GymSearchFilters {
  name?: string;
  location?: string;
}

export async function getGyms(filters?: GymSearchFilters): Promise<GymWithCounts[]> {
  const supabase = await createClient();
  let query = supabase.from("gyms").select(GYM_SELECT);

  const name = filters?.name?.trim();
  const location = filters?.location?.trim();
  // Escape %, _ y \ para que el ilike los trate como literales
  const escapeLike = (v: string) => v.replace(/[\\%_]/g, (m) => `\\${m}`);
  if (name) query = query.ilike("name", `%${escapeLike(name)}%`);
  if (location) query = query.ilike("address", `%${escapeLike(location)}%`);

  const { data, error } = await query.order("name", { ascending: true }).limit(200);
  if (error) throw error;

  const gyms = (data ?? []) as Gym[];
  if (gyms.length === 0) return [];
  const ids = gyms.map((g) => g.id);

  const [membersRes, routinesRes, trainersRes] = await Promise.all([
    supabase.from("gym_members").select("gym_id").in("gym_id", ids),
    supabase.from("routines").select("gym_id").not("gym_id", "is", null).in("gym_id", ids),
    supabase.from("gym_trainers").select("gym_id").in("gym_id", ids),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (routinesRes.error) throw routinesRes.error;
  if (trainersRes.error) throw trainersRes.error;

  const countBy = (rows: { gym_id: string }[] | null) => {
    const map = new Map<string, number>();
    for (const r of rows ?? []) map.set(r.gym_id, (map.get(r.gym_id) ?? 0) + 1);
    return map;
  };
  const members = countBy(membersRes.data as { gym_id: string }[] | null);
  const routines = countBy(routinesRes.data as { gym_id: string }[] | null);
  const trainers = countBy(trainersRes.data as { gym_id: string }[] | null);

  return gyms.map((g) => ({
    ...g,
    membersCount: members.get(g.id) ?? 0,
    routinesCount: routines.get(g.id) ?? 0,
    trainersCount: trainers.get(g.id) ?? 0,
  }));
}

export async function getGymById(gymId: string): Promise<Gym> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gyms")
    .select(GYM_SELECT)
    .eq("id", gymId)
    .single();
  if (error) throw error;
  return data as Gym;
}

export async function getMyGymMembership(userId: string): Promise<GymMember | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_members")
    .select("gym_id,user_id,role,joined_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as GymMember | null) ?? null;
}

type PublicProfile = { id: string; name: string | null; avatar_url: string | null };

async function getProfileMap(userIds: string[]): Promise<Map<string, PublicProfile>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id,name,avatar_url")
    .in("id", unique);
  if (error) throw error;
  return new Map(
    ((data ?? []) as PublicProfile[]).map((p) => [String(p.id), p])
  );
}

export async function getGymMembers(gymId: string): Promise<GymMemberWithProfile[]> {
  const supabase = await createClient();
  const [{ data: members, error: membersError }, { data: trainers, error: trainersError }] =
    await Promise.all([
      supabase
        .from("gym_members")
        .select("gym_id,user_id,role,joined_at")
        .eq("gym_id", gymId)
        .order("joined_at", { ascending: true }),
      supabase.from("gym_trainers").select("user_id").eq("gym_id", gymId),
    ]);
  if (membersError) throw membersError;
  if (trainersError) throw trainersError;

  const rows = (members ?? []) as GymMember[];
  const trainerIds = new Set(((trainers ?? []) as { user_id: string }[]).map((t) => String(t.user_id)));
  const profiles = await getProfileMap(rows.map((m) => m.user_id));

  const roleRank: Record<GymMemberRole, number> = { owner: 0, admin: 1, member: 2 };
  return rows
    .map((m) => ({
      ...m,
      name: profiles.get(m.user_id)?.name || "Usuario",
      avatar_url: profiles.get(m.user_id)?.avatar_url ?? null,
      is_trainer: trainerIds.has(m.user_id),
    }))
    .sort((a, b) => roleRank[a.role] - roleRank[b.role]);
}

export async function getGymTrainers(gymId: string): Promise<GymTrainerWithProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_trainers")
    .select("id,gym_id,user_id,specialty,schedule,created_at")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as GymTrainer[];
  if (rows.length === 0) return [];
  const profiles = await getProfileMap(rows.map((t) => t.user_id));

  return rows.map((t) => ({
    ...t,
    schedule: (t.schedule ?? []) as TrainerScheduleEntry[],
    name: profiles.get(t.user_id)?.name || "Usuario",
    avatar_url: profiles.get(t.user_id)?.avatar_url ?? null,
  }));
}

export interface GymRoutineItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  exercisesCount: number;
  createdAt: string;
}

export async function getGymRoutines(gymId: string): Promise<GymRoutineItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routines")
    .select("id,name,description,category,created_at")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const rows = (data ?? []) as Routine[];
  if (rows.length === 0) return [];

  const { data: counts, error: countsError } = await supabase
    .from("routine_exercises")
    .select("routine_id")
    .in("routine_id", rows.map((r) => r.id));
  if (countsError) throw countsError;

  const countByRoutine = new Map<string, number>();
  for (const row of (counts ?? []) as { routine_id: string }[]) {
    countByRoutine.set(row.routine_id, (countByRoutine.get(row.routine_id) ?? 0) + 1);
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category ?? null,
    exercisesCount: countByRoutine.get(r.id) ?? 0,
    createdAt: r.created_at,
  }));
}

// ---------- Escrituras (RPCs + RLS) ----------

export async function createGym(payload: CreateGymPayload): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_gym", {
    p_name: payload.nombre,
    p_description: payload.descripcion ?? null,
    p_phone: payload.telefono ?? null,
    p_email: payload.email ?? null,
    p_instagram: payload.instagram ?? null,
    p_website: payload.website ?? null,
    p_address: payload.direccion ?? null,
    p_maps_url: payload.maps_url ?? null,
    p_latitude: payload.latitude ?? null,
    p_longitude: payload.longitude ?? null,
  });
  if (error) throwSupabase(error, "No se pudo crear el gimnasio");
  return data as string;
}

export async function updateGym(gymId: string, updates: UpdateGymPayload) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gyms")
    .update(updates)
    .eq("id", gymId)
    .select()
    .single();
  if (error) throwSupabase(error, "No se pudo guardar el gimnasio");
  return data as Gym;
}

export async function deleteGym(gymId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("gyms").delete().eq("id", gymId);
  if (error) throwSupabase(error, "No se pudo eliminar el gimnasio");
}

export async function joinGym(gymId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_gym", { p_gym_id: gymId });
  if (error) throwSupabase(error, "No pudiste unirte al gimnasio");
}

export async function leaveGym() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_gym", {});
  if (error) throwSupabase(error, "No pudiste salir del gimnasio");
}

export async function manageGymMember(
  gymId: string,
  userId: string,
  action: "make_admin" | "remove_admin" | "remove"
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_gym_member", {
    p_gym_id: gymId,
    p_user_id: userId,
    p_action: action,
  });
  if (error) throwSupabase(error, "No se pudo actualizar el miembro");
}

export async function manageGymTrainer(
  gymId: string,
  userId: string,
  action: "add" | "remove",
  opts?: { specialty?: string | null; schedule?: TrainerScheduleEntry[] }
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_gym_trainer", {
    p_gym_id: gymId,
    p_user_id: userId,
    p_action: action,
    p_specialty: opts?.specialty ?? null,
    p_schedule: (opts?.schedule ?? []) as unknown as string,
  });
  if (error) throwSupabase(error, "No se pudo actualizar el profesor");
}

export async function forkGymRoutine(routineId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fork_gym_routine", { p_routine_id: routineId });
  if (error) throwSupabase(error, "No se pudo copiar la rutina");
  return data as string;
}

export async function assignGymRoutine(routineId: string, memberId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_gym_routine", {
    p_routine_id: routineId,
    p_member_id: memberId,
  });
  if (error) throwSupabase(error, "No se pudo asignar la rutina");
  return data as string;
}

export async function addGymMemberByEmail(gymId: string, email: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_gym_member_by_email", {
    p_gym_id: gymId,
    p_email: email.trim(),
  });
  if (error) throwSupabase(error, "No se pudo agregar al miembro");
  return data as string;
}

export async function createGymRoutine(
  gymId: string,
  payload: { nombre: string; descripcion?: string | null; categoria?: string | null }
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_gym_routine", {
    p_gym_id: gymId,
    p_name: payload.nombre,
    p_description: payload.descripcion ?? null,
    p_category: payload.categoria ?? null,
  });
  if (error) throwSupabase(error, "No se pudo crear la rutina del gimnasio");
  return data as string;
}

export async function publishRoutineToGym(routineId: string, gymId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_routine_to_gym", {
    p_routine_id: routineId,
    p_gym_id: gymId,
  });
  if (error) throwSupabase(error, "No se pudo publicar la rutina en el gimnasio");
  return data as string;
}

export async function deleteGymRoutine(routineId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_gym_routine", { p_routine_id: routineId });
  if (error) throwSupabase(error, "No se pudo eliminar la rutina del gimnasio");
}

export async function canCurrentUserCreateGym(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_current_user_create_gym");
  if (error) return false;
  return !!data;
}

export async function isAppAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_app_admin");
  if (error) return false;
  return !!data;
}

export async function approveGymCreator(email: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_gym_creator", { p_email: email.trim() });
  if (error) throwSupabase(error, "No se pudo habilitar al usuario");
  return data as string;
}

export async function revokeGymCreator(email: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_gym_creator", { p_email: email.trim() });
  if (error) throwSupabase(error, "No se pudo revocar");
  return data as string;
}

export async function listGymCreatorApprovals(): Promise<{ user_id: string; email: string; name: string | null; can_create_gym: boolean; gym_id: string | null }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_gym_creator_approvals");
  if (error) throwSupabase(error, "No se pudo listar");
  return (data ?? []) as { user_id: string; email: string; name: string | null; can_create_gym: boolean; gym_id: string | null }[];
}

export function normalizeHexColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(v) ? v : null;
}

// ---------- Logo ----------

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_BUCKET = "gym-logos";

export async function uploadGymLogo(gymId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("El logo debe ser una imagen");
  if (file.size > LOGO_MAX_BYTES) throw new Error("El logo no puede superar 2 MB");

  const supabase = await createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${gymId}/logo-${Date.now()}.${ext}`;

  // Borrar logos anteriores de la carpeta (reemplazo limpio)
  const { data: existing } = await supabase.storage.from(LOGO_BUCKET).list(gymId);
  if (existing && existing.length > 0) {
    await supabase.storage
      .from(LOGO_BUCKET)
      .remove(existing.map((f) => `${gymId}/${f.name}`));
  }

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const url = data.publicUrl;
  await updateGym(gymId, { logo_url: url });
  return url;
}
