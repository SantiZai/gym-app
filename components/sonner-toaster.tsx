"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function SonnerToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster position="top-center" theme={resolvedTheme === "dark" ? "dark" : "light"} />;
}
