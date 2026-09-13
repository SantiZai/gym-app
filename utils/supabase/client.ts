import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

// Singleton: evita crear un cliente (y revalidar auth) en cada query.
// Antes cada util hacía `await createClient()` → cliente nuevo por llamada.
let cached: SupabaseClient | null = null

export const createClient = async () => {
    if (cached) return cached
    cached = createBrowserClient(supabaseUrl, supabaseAnonKey)
    return cached
}