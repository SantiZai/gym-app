import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

// Rutas que requieren sesión. Sin usuario redirigen a /login.
const PROTECTED_PREFIXES = ["/rutinas", "/progreso", "/perfil", "/comunidad", "/sesion"];
// Páginas de auth: si ya hay sesión, van al inicio.
const AUTH_PAGES = ["/login", "/register"];

function withCookies(target: NextResponse, source: NextResponse): NextResponse {
  // Copia set-cookie crudos (conserva flags) en vez de name/value.
  for (const cookie of source.headers.getSetCookie()) {
    target.headers.append("set-cookie", cookie);
  }
  return target;
}

export async function middleware(request: NextRequest) {
  const { response: supabaseResponse, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isProtected =
    PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return withCookies(NextResponse.redirect(url), supabaseResponse);
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return withCookies(NextResponse.redirect(url), supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
