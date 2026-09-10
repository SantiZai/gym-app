"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { User } from "@/types/db";
import { upsertUser } from "@/utils/userUtils";

// Cachea el sync por usuario: evita upserts duplicados entre
// getSession + evento INITIAL_SESSION y entre instancias del hook (Navbar + página)
let syncCache: { userId: string; promise: Promise<User | null> } | null = null;

export const useAuth = () => {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      // Crear cliente de Supabase en el navegador
      const supabase = await createClient();

      // Obtener la sesión inicial
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setSupabaseUser(session.user);
        setSession(session);
        // Crear/actualizar usuario en nuestra tabla
        await handleUserSync(session.user);
      }
      setIsLoading(false);

      // Escuchar cambios en el estado de autenticación
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        if (nextSession?.user) {
          setSupabaseUser(nextSession.user);
          setSession(nextSession);
          // Crear/actualizar usuario en nuestra tabla
          await handleUserSync(nextSession.user);
        } else {
          syncCache = null;
          setSupabaseUser(null);
          setUser(null);
          setSession(null);
        }
        setIsLoading(false);
      });

      unsubscribe = () => subscription.unsubscribe();
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleUserSync = async (supabaseUser: SupabaseUser) => {
    try {
      if (!syncCache || syncCache.userId !== supabaseUser.id) {
        syncCache = { userId: supabaseUser.id, promise: upsertUser(supabaseUser) };
      }
      setUser(await syncCache.promise);
    } catch (error) {
      syncCache = null;
      console.error("Error syncing user:", error);
      setUser(null);
    }
  };

  return {
    supabaseUser,
    session,
    user,
    isLoading,
    isAuthenticated: !!supabaseUser,
  };
};
