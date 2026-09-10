"use client";

import { ActionState } from "@/utils/auth/middleware";
import { createClient } from "@/utils/supabase/client";
import { useActionState, useState } from "react";
import { signInWithMagicLink } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const Login = ({ mode = "signin" }: { mode?: "signin" | "signup" }) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    const redirectTo = `${window.location.origin}/api/callback`;
    setLoading(true);
    const supabase = await createClient();
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    setLoading(false);
  };

  const [magicLinkState, magicLinkAction, pending] = useActionState<
    ActionState,
    FormData
  >(signInWithMagicLink, { error: "", success: "" });

  const isSignin = mode === "signin";

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-white to-slate-50 flex items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center">
          <Image
            src="/icons/icon-192.png"
            alt="DiaUno"
            width={56}
            height={56}
            className="rounded-2xl"
            priority
          />
          <p className="mt-3 text-xl font-bold text-slate-900">DiaUno</p>
        </div>

        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-center text-slate-900">
          {isSignin ? "Hola de nuevo" : "Creá tu cuenta"}
        </h1>
        <p className="mt-2 text-sm text-center text-slate-600">
          {isSignin
            ? "Entrá para seguir entrenando"
            : "Empezá a registrar tu progreso hoy"}
        </p>

        <div className="mt-10">
          {magicLinkState?.success ? (
            <div className="p-6 text-center bg-green-50 rounded-lg">
              <h3 className="text-sm font-medium text-green-800">
                Revisá tu email
              </h3>
              <p className="mt-2 text-sm text-green-700">
                Te enviamos un enlace para entrar a tu cuenta.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <form action={magicLinkAction} className="space-y-4">
                <Input
                  name="email"
                  type="email"
                  placeholder="tu@email.com"
                  required
                  className="px-4 h-12 bg-white rounded-lg border-slate-200 shadow-sm transition-colors focus:border-blue-500 focus:ring-blue-500"
                />

                <Button
                  type="submit"
                  className="w-full h-12 font-medium text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {pending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Continuar con email"
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="flex absolute inset-0 items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="flex relative justify-center">
                  <span className="px-4 text-sm text-slate-500 bg-gradient-to-b from-white to-slate-50">
                    o
                  </span>
                </div>
              </div>

              <Button
                onClick={handleGoogleSignIn}
                className="w-full h-12 font-medium text-slate-700 bg-white rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <div className="flex justify-center items-center">
                    <svg className="mr-2 w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continuar con Google
                  </div>
                )}
              </Button>
            </div>
          )}

          {magicLinkState?.error && (
            <div className="mt-4 text-sm text-red-600">
              {magicLinkState.error}
            </div>
          )}

          <p className="mt-8 text-sm text-center text-slate-600">
            {isSignin ? "¿Primera vez acá? " : "¿Ya tenés cuenta? "}
            <Link
              href={`${isSignin ? "/register" : "/login"}`}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              {isSignin ? "Creá una cuenta" : "Iniciá sesión"}
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-slate-500">
            Al continuar aceptás nuestra{" "}
            <Link href="/privacidad" className="underline underline-offset-2 hover:text-slate-700">
              Política de Privacidad
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
