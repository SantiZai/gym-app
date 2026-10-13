import type { Metadata } from "next";
import { getUser } from "@/queries/user";
import { redirect } from "next/navigation";
import { Login } from "../login";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Creá tu cuenta en Habitus y empezá a entrenar con propósito.",
  alternates: {
    canonical: "/register",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default async function RegisterPage() {
  const user = await getUser();
  if (user) {
    redirect("/");
  }

  return <Login mode="signup" />;
}
