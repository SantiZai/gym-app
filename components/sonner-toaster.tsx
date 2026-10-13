"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function SonnerToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      // Abajo y no arriba: en iPhone el top queda bajo la isla/notch y el
      // blur del sistema lo deja ilegible (ej. aviso de "nueva versión").
      position="bottom-center"
      offset="24px"
      mobileOffset="calc(env(safe-area-inset-bottom, 0px) + 96px)"
      gap={8}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      toastOptions={{
        style: {
          // Sólido, sin translucidez: en iOS el backdrop-blur se ve mal.
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
        },
      }}
    />
  );
}
