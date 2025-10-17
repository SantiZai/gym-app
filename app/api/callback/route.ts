import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { upsertUserServer } from "@/utils/userUtilsServer";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = "/";

  const supabase = await createClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error("Error exchanging code for session:", error);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=${error.message}`);
    }

    // Crear/actualizar usuario en la tabla users
    if (data.user) {
      try {
        await upsertUserServer(data.user);
      } catch (error) {
        console.error("Error upserting user:", error);
        // No redirigir con error, solo loguear
      }
    }
  }
  return NextResponse.redirect(`${requestUrl.origin}${redirectTo}`);
}
