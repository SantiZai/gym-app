import { createClient } from "./supabase/client";

export const startSession = async (rutinaId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_session', { p_rutina_id: rutinaId });
  if (error) throw error;
  // data es uuid retornado (puede variar según supabase rpc wrapper)
  // if supabase returns array: const sesionId = data[0];
  const sesionId = data as unknown as string;
  // redirigir a la ruta de sesión
  window.location.href = `/sesion/${sesionId}`;
}