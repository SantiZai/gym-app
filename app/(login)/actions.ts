"use server";

import { z } from "zod";
import { validatedAction } from "@/utils/auth/middleware";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const APP_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const signInSchema = z.object({
  email: z.email().min(3).max(255),
  password: z.string().min(8).max(100),
});

export const signIn = validatedAction(signInSchema, async (data) => {
  const supabase = await createClient();
  const { email, password } = data;

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Invalid credentials. Please try again." };
  }

  const { error: userDataError } = await supabase
    .from("users")
    .select("*")
    .eq("id", signInData.user.id)
    .single();

  if (userDataError && userDataError.code === "PGRST116") {
    // No user entry found, create one
    const { error: insertError } = await supabase.from("users").insert({
      id: signInData.user.id,
    });

    if (insertError) {
      console.error("Error creating users entry:", insertError);
    }
  }

  redirect("/");
});

const signUpSchema = z.object({
  email: z.email().min(3).max(255),
  password: z.string().min(8).max(100),
  /* TODO: podemos crear links de invitación para descuentos
    inviteId: z.string().optional()*/
});

export const signUp = validatedAction(signUpSchema, async (data) => {
  const supabase = await createClient();
  const { email, password } = data;

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  const { error: insertError } = await supabase.from("users").insert({
    id: signUpData?.user?.id,
  });

  if (insertError) {
    console.error("Error creating users entry:", insertError);
  }

  redirect("/");
});

export const signInWithMagicLink = validatedAction(
  z.object({
    email: z.email().min(3).max(255),
    redirect: z.string().optional(),
  }),
  async (data) => {
    const supabase = await createClient();
    const { email } = data;
    /*TODO: podemos usar archivo config para traer la ruta de la app de forma dinámica con config.domainName*/
    const redirectTo = `${APP_ORIGIN}/api/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      console.error("Error sending magic link:", error);
      return { error: error.message };
    }

    return { success: "Magic link sent to your email." };
  }
);

export const signInWithGoogle = async (
  event: React.FormEvent<HTMLFormElement>
) => {
  event.preventDefault();
  const supabase = await createClient();

  try {
    const redirectTo = `${APP_ORIGIN}/api/callback`;
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (signInError) {
      return { error: "Failed to sign in with Google. Please try again." };
    }
  } catch (error) {
    console.error("Error signing in with Google:", error);
    return { error: "Failed to sign in with Google. Please try again." };
  }
};

export const signOut = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
};
