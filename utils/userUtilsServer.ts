"use server";

import { createClient } from "./supabase/server";
import { User } from "@/types/db";

// Versión para usar en el servidor (Server Actions, API Routes)
export const upsertUserServer = async (supabaseUser: any): Promise<User> => {
  const supabase = await createClient();

  // Extraer datos del usuario de supabase
  const { id, email, user_metadata } = supabaseUser;
  const { name, avatar_url, picture } = user_metadata || {};

  // Usar la imagen de Google si está disponible
  const userAvatar = avatar_url || picture;

  console.log("Creando/actualizando usuario (server):", { id, email, name });
  
  // Datos del usuario para insertar/actualizar
  const userData = {
    id,
    email,
    name: name || email?.split("@")[0] || "Anonimous",
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
    console.error("Error upserting user (server):", error);
    throw error;
  }

  console.log("Usuario creado/actualizado exitosamente:", data);
  return data;
};
