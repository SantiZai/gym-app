/* Service worker de Habitus: app instalable + páginas básicas sin conexión.
 * - Documentos: network-first con fallback a caché y a /offline.
 * - Estáticos (_next/static, iconos): cache-first (stale-while-revalidate).
 * - APIs y Supabase: solo red (nunca se cachean).
 * Versioneá CACHE_NAME en cada cambio de esta estrategia.
 */

const CACHE_NAME = "habitus-v1";
const PRECACHE = [
  "/offline",
  "/",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon.svg",
  "/manifest.webmanifest",
];

// Rutas públicas: las únicas navegaciones que se cachean. Las protegidas
// van solo a red (evita mostrar HTML stale con otra sesión tras logout).
const PUBLIC_PATHS = new Set(["/", "/offline", "/privacidad", "/login", "/register"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  // Solo mismo origen: Supabase y CDNs van directo a red.
  if (url.origin !== self.location.origin) return;
  // APIs y auth: solo red.
  if (url.pathname.startsWith("/api/")) return;

  // Navegaciones: red primero; caché solo en rutas públicas; /offline al final.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (PUBLIC_PATHS.has(url.pathname)) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit ?? caches.match("/offline"))
        )
    );
    return;
  }

  // Estáticos: caché primero, red en background.
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((hit) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return res;
          })
          .catch(() => hit);
        return hit ?? network;
      })
    );
    return;
  }

  // Resto (payloads RSC, etc.): red primero con fallback a caché.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
