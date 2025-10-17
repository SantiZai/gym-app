"use server";

import { createClient } from "@/utils/supabase/server";

/**
 * Obtiene el usuario autenticado actual desde Supabase.
 * 
 * Esta función recupera la información del usuario que está actualmente autenticado
 * en la sesión. Utiliza el cliente de Supabase del lado del servidor para acceder
 * a los datos de autenticación de forma segura.
 * 
 * @returns {Promise<User | null>} El objeto del usuario autenticado o null si hay un error
 * o no hay usuario autenticado.
 * 
 * @example
 * // Usar en Server Components o Server Actions
 * const user = await getUser();
 * if (!user) {
 *   redirect('/login');
 * }
 * 
 * @remarks
 * - Debe usarse en Server Components, Server Actions o Route Handlers
 * - Retorna null si el usuario no está autenticado o si ocurre un error
 * - No lanza excepciones, maneja errores internamente
 */
export const getUser = async () => {
    const supabase = await createClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();
    if (error) {
        return null;
    }

    return user;
};