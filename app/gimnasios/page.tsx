"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Building2,
  Mail,
  Plus,
  Search,
  Users,
  Dumbbell,
  GraduationCap,
  MapPin,
  Navigation,
  LocateFixed,
  X,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canCurrentUserCreateGym, getGyms, getMyGymMembership, type GymWithCounts } from "@/utils/gymUtils";
import type { GymMember } from "@/types/db";
import { distanceKm, formatDistance, type GeoStatus } from "@/lib/geo";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function GymLogo({ name, logoUrl, size }: { name: string; logoUrl: string | null; size: number }) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-xl object-cover bg-slate-100"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function GymCard({
  gym,
  badge,
  distanceLabel,
}: {
  gym: GymWithCounts;
  badge?: string;
  distanceLabel?: string | null;
}) {
  return (
    <Link
      href={`/gimnasios/${gym.id}`}
      className="bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-200 p-5 flex flex-col"
    >
      <div className="flex items-start gap-3">
        <GymLogo name={gym.name} logoUrl={gym.logo_url} size={52} />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-slate-900 truncate">{gym.name}</h3>
          {gym.address && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              {gym.address}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {badge && (
              <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {badge}
              </span>
            )}
            {distanceLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                <Navigation className="h-3 w-3" />
                {distanceLabel}
              </span>
            )}
          </div>
        </div>
      </div>
      {gym.description && (
        <p className="mt-3 text-sm text-slate-600 line-clamp-2">{gym.description}</p>
      )}
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {gym.membersCount} {gym.membersCount === 1 ? "miembro" : "miembros"}
        </span>
        <span className="flex items-center gap-1">
          <Dumbbell className="h-3.5 w-3.5" />
          {gym.routinesCount} {gym.routinesCount === 1 ? "rutina" : "rutinas"}
        </span>
        <span className="flex items-center gap-1">
          <GraduationCap className="h-3.5 w-3.5" />
          {gym.trainersCount} {gym.trainersCount === 1 ? "profe" : "profes"}
        </span>
      </div>
    </Link>
  );
}

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

export default function GimnasiosPage() {
  const { user } = useAuth();
  const [gyms, setGyms] = useState<GymWithCounts[]>([]);
  const [membership, setMembership] = useState<GymMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [canCreate, setCanCreate] = useState(false);

  // Borradores (lo que el usuario escribe) vs aplicados (lo que se buscó con el botón)
  const [nameInput, setNameInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [appliedName, setAppliedName] = useState("");
  const [appliedLocation, setAppliedLocation] = useState("");

  // Geolocalización
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(25);

  const loadGyms = useCallback(async (name: string, location: string) => {
    setSearching(true);
    try {
      const g = await getGyms({
        name: name.trim() || undefined,
        location: location.trim() || undefined,
      });
      setGyms(g);
    } catch {
      setGyms([]);
      toast.error("No se pudieron cargar los gimnasios");
    } finally {
      setSearching(false);
    }
  }, []);

  // Carga inicial: todos los gimnasios + membresía
  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      getGyms().catch(() => [] as GymWithCounts[]),
      getMyGymMembership(user.id).catch(() => null),
      canCurrentUserCreateGym().catch(() => false),
    ])
      .then(([g, m, c]) => {
        if (!alive) return;
        setGyms(g);
        setMembership(m);
        setCanCreate(!!c);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user]);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoStatus("unavailable");
      setGeoError("Tu dispositivo o navegador no soporta geolocalización.");
      return;
    }
    setGeoStatus("loading");
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoStatus("granted");
        setGeoError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus("denied");
          setGeoError(
            "No pudimos acceder a tu ubicación. Activá el permiso en el navegador para ver los gimnasios cercanos."
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoStatus("unavailable");
          setGeoError("No pudimos determinar tu ubicación en este momento. Probá de nuevo.");
        } else {
          setGeoStatus("unavailable");
          setGeoError("Se agotó el tiempo esperando tu ubicación. Probá de nuevo.");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  // Si el permiso ya está concedido, activamos la ubicación solos (sin molestar con prompt)
  useEffect(() => {
    if (userCoords || geoStatus !== "idle") return;
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((result) => {
        if (!cancelled && result.state === "granted") requestLocation();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userCoords, geoStatus, requestLocation]);

  const handleSearch = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const name = nameInput.trim();
      const location = locationInput.trim();
      setAppliedName(name);
      setAppliedLocation(location);
      void loadGyms(name, location);
    },
    [nameInput, locationInput, loadGyms]
  );

  const handleClear = useCallback(() => {
    setNameInput("");
    setLocationInput("");
    setAppliedName("");
    setAppliedLocation("");
    setNearbyOnly(false);
    void loadGyms("", "");
  }, [loadGyms]);

  const hasActiveFilters = appliedName !== "" || appliedLocation !== "" || nearbyOnly;

  // Distancia por gimnasio (null = sin coords para calcular)
  const distances = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const g of gyms) {
      if (
        userCoords &&
        g.latitude != null &&
        g.longitude != null &&
        Number.isFinite(g.latitude) &&
        Number.isFinite(g.longitude)
      ) {
        map.set(g.id, distanceKm(userCoords, { latitude: g.latitude, longitude: g.longitude }));
      } else {
        map.set(g.id, null);
      }
    }
    return map;
  }, [gyms, userCoords]);

  const sorted = useMemo(() => {
    let list = [...gyms];
    // Filtro de cercanía: solo gimnasios con coords dentro del radio
    if (userCoords && nearbyOnly) {
      list = list.filter((g) => {
        const d = distances.get(g.id);
        return d != null && d <= maxDistanceKm;
      });
    }
    // Orden: por distancia si hay ubicación, si no por nombre
    if (userCoords) {
      list.sort((a, b) => {
        const da = distances.get(a.id);
        const db = distances.get(b.id);
        if (da != null && db != null) return da - db;
        if (da != null) return -1;
        if (db != null) return 1;
        return a.name.localeCompare(b.name, "es");
      });
    }
    return list;
  }, [gyms, userCoords, nearbyOnly, maxDistanceKm, distances]);

  // Mi gimnasio siempre visible arriba (aunque no matchee el filtro, es tuyo);
  // el resto es el resultado de la búsqueda.
  // Para saber si "mi gimnasio" pasó el filtro, lo buscamos en `sorted`.
  const myGymId = membership?.gym_id ?? null;
  const myGymInResults = myGymId ? sorted.find((g) => g.id === myGymId) : undefined;
  const myGymFallback = myGymId ? gyms.find((g) => g.id === myGymId) : undefined;
  const myGym = myGymInResults ?? myGymFallback;
  const others = myGymId ? sorted.filter((g) => g.id !== myGymId) : sorted;

  const distanceLabelFor = (gymId: string): string | null => {
    if (!userCoords) return null;
    return formatDistance(distances.get(gymId) ?? null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title="Gimnasios"
          description="Unite a tu gimnasio para entrenar con sus rutinas y profesores."
        />

        {canCreate ? (
          <div className="flex justify-end">
            <Link
              href="/gimnasios/nuevo"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Crear gimnasio
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/30">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
              <Building2 className="h-4 w-4" />
              ¿Querés adherir tu gimnasio?
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-200/90">
              La creación de gimnasios está gestionada por el equipo de Habitus. Si querés que tu
              gimnasio forme parte de la plataforma, escribinos y lo damos de alta. Una vez
              habilitado podrás crearlo con el formulario y quedarás como dueño y profe automáticamente.
            </p>
            <a
              href={
                "mailto:habitus.gymapp@gmail.com" +
                "?subject=" +
                encodeURIComponent("Solicitud para adherir mi gimnasio a Habitus") +
                "&body=" +
                encodeURIComponent(
                  "Hola equipo de Habitus,\n\nQuiero adherir mi gimnasio a la plataforma.\n\n" +
                    "Nombre del gimnasio:\n" +
                    "Dirección (ubicación real):\n" +
                    "Ciudad / Provincia:\n" +
                    "Teléfono / WhatsApp:\n" +
                    "Email de contacto:\n" +
                    "Instagram / Web (opcional):\n" +
                    "Breve descripción:\n\n" +
                    "Quedo a la espera de los pasos para el alta.\n\nGracias!"
                )
              }
              className="mt-3 inline-flex items-center rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-950 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              <Mail className="h-4 w-4 mr-1.5" />
              Solicitar alta por mail
            </a>
          </div>
        )}

        {/* Buscador */}
        <form
          onSubmit={handleSearch}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Nombre</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Ej: Gimnasio Central"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Ubicación</span>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="Ej: Palermo, Córdoba, Av. Corrientes"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </label>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={searching}
                className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-1.5" />
                )}
                {searching ? "Buscando…" : "Buscar"}
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Limpiar
                </button>
              )}
            </div>
            <div className="sm:ml-auto">
              {geoStatus === "granted" && userCoords ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                  <Navigation className="h-3.5 w-3.5" />
                  Ubicación activada · ordenados por cercanía
                </span>
              ) : (
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={geoStatus === "loading"}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {geoStatus === "loading" ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <LocateFixed className="h-4 w-4 mr-1.5" />
                  )}
                  {geoStatus === "loading" ? "Obteniendo ubicación…" : "Cerca de mí"}
                </button>
              )}
            </div>
          </div>

          {geoError && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-200">
              {geoError}
            </p>
          )}

          {userCoords && (
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={nearbyOnly}
                  onChange={(e) => setNearbyOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Mostrar solo cercanos
              </label>
              {nearbyOnly && (
                <label className="flex items-center gap-2 text-sm text-slate-700 sm:ml-2">
                  Dentro de
                  <select
                    value={maxDistanceKm}
                    onChange={(e) => setMaxDistanceKm(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    {RADIUS_OPTIONS.map((km) => (
                      <option key={km} value={km}>
                        {km} km
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          <p className="mt-3 text-xs text-slate-500" aria-live="polite">
            {searching
              ? "Buscando gimnasios…"
              : others.length === 0 && !myGym
                ? "No se encontraron gimnasios para los filtros dados."
                : `${others.length + (myGym ? 1 : 0)} ${
                    others.length + (myGym ? 1 : 0) === 1 ? "gimnasio" : "gimnasios"
                  }${
                    userCoords
                      ? " · ordenados por cercanía"
                      : " · activá tu ubicación para ver primero los más cercanos"
                  }`}
          </p>
        </form>

        {myGym && (
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Mi gimnasio
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GymCard
                gym={myGym}
                badge="Mi gimnasio"
                distanceLabel={distanceLabelFor(myGym.id)}
              />
            </div>
          </div>
        )}

        <div>
          {myGym && (
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {hasActiveFilters || userCoords ? "Resultados" : "Otros gimnasios"}
            </h2>
          )}
          {others.length === 0 ? (
            <EmptyState
              title={hasActiveFilters ? "No se encontraron gimnasios para los filtros dados" : gyms.length === 0 && !myGym ? "Todavía no hay gimnasios" : "Sin resultados"}
              description={
                hasActiveFilters
                  ? nearbyOnly && userCoords
                    ? `No se encontraron gimnasios para los filtros dados a menos de ${maxDistanceKm} km. Probá ampliar el radio o limpiá los filtros.`
                    : "No se encontraron gimnasios para los filtros dados. Probá con otro nombre o zona, o limpiá los filtros."
                  : gyms.length === 0 && !myGym
                    ? "Aún no hay gimnasios dados de alta. Si querés adherir el tuyo, usá el bloque de arriba para contactarnos."
                    : "Probá con otro nombre o zona, o limpiá los filtros."
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {others.map((g) => (
                <GymCard key={g.id} gym={g} distanceLabel={distanceLabelFor(g.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
