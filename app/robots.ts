import type { MetadataRoute } from "next";

const SITE_URL = "https://habitus.lat";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/rutinas/",
          "/rutinas",
          "/progreso/",
          "/progreso",
          "/perfil/",
          "/perfil",
          "/comunidad/",
          "/comunidad",
          "/sesion/",
          "/sesion",
          "/gimnasios/",
          "/gimnasios",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
