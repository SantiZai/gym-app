import type { Metadata } from "next";
import { getUser } from "@/queries/user";
import { redirect } from "next/navigation";
import { Login } from "../login";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Iniciá sesión en Habitus para gestionar tus rutinas y progreso.",
  alternates: {
    canonical: "/login",
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

  return <Login mode="signin" />;
}
