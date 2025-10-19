import { createClient } from "./supabase/client";
import { User } from "@/types/db";

export const upsertUser = async (supabaseUser: any): Promise<User> => {
  const supabase = await createClient();

  // Extraer datos del usuario de supabase
  const { id, email, user_metadata } = supabaseUser;
  const { name, avatar_url, picture } = user_metadata || {};

  // Usar la imagen de Google si está disponible
  const userAvatar = avatar_url || picture;

  console.log("user actualizar", supabaseUser);
  // Datos del usuario para insertar/actualizar
  const userData = {
    id,
    email,
    name: name || email.split("@")[0],
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
