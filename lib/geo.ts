export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Distancia en km entre dos puntos (fórmula haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371; // radio terrestre en km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "800 m" / "2,3 km" según magnitud, en español. */
export function formatDistance(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) {
    const m = Math.round(km * 1000);
    return `${m} m`;
  }
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

export type GeoStatus = "idle" | "loading" | "granted" | "denied" | "unavailable";

export function getGeoErrorMessage(status: GeoStatus, rawError?: string | null): string | null {
  if (status === "denied")
    return "No pudimos acceder a tu ubicación. Activá el permiso en el navegador para ver los gimnasios cercanos.";
  if (status === "unavailable")
    return rawError ?? "Tu dispositivo o navegador no soporta geolocalización.";
  return null;
}
