import { createClient } from "./supabase/client";
import { User } from "@/types/db";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export const upsertUser = async (supabaseUser: SupabaseUser): Promise<User> => {
  const supabase = await createClient();

  // Extraer datos del usuario de supabase
  const { id, email, user_metadata } = supabaseUser;
  const { name, avatar_url, picture } = user_metadata || {};

  // Usar la imagen de Google si está disponible
  const userAvatar = avatar_url || picture;

  // Datos del usuario para insertar/actualizar
  const userData = {
    id,
    email,
    name: name || email?.split("@")[0] || "Usuario",
    avatar_url: userAvatar || "",
    unit: "metric",
    updated_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
  };

  // Intentar insertar o actualizar el usuario
  const { data, error } = await supabase
    .from("users")
    .upsert(userData, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    console.error("Error upserting user:", error);
    throw error;
  }

  return data;
};

export const updateUserProfile = async (
  userId: string,
  updates: { goal?: string | null; height?: number | null; weight?: number | null }
): Promise<User> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as User;
};
