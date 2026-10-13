import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Habitus - Entrenamiento con propósito",
    short_name: "Habitus",
    description: "Gestiona tus rutinas, ejercicios y progreso. Entrenamiento con propósito.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "es",
    dir: "ltr",
    categories: ["health", "fitness", "lifestyle"],
    shortcuts: [
      {
        name: "Mis rutinas",
        url: "/rutinas",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Mi progreso",
        url: "/progreso",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
