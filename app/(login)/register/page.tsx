import { getUser } from "@/queries/user";
import { redirect } from "next/navigation";
import { Login } from "../login";

export default async function RegisterPage() {
  const user = await getUser();
  if (user) {
    redirect("/");
  }

  return <Login mode="signup" />;
}
