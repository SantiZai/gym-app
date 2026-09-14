"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canCurrentUserCreateGym, createGym } from "@/utils/gymUtils";
import { AddressAutocomplete } from "@/components/shared/AddressAutocomplete";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail } from "lucide-react";

const CONTACT_EMAIL = "habitus.gymapp@gmail.com";
const CONTACT_SUBJECT = "Solicitud para adherir mi gimnasio a Habitus";
const CONTACT_BODY =
  "Hola equipo de Habitus,\n\nQuiero adherir mi gimnasio a la plataforma.\n\n" +
  "Nombre del gimnasio:\n" +
  "Dirección (ubicación real):\n" +
  "Ciudad / Provincia:\n" +
  "Teléfono / WhatsApp:\n" +
  "Email de contacto:\n" +
  "Instagram / Web (opcional):\n" +
  "Breve descripción:\n\n" +
  "Quedo a la espera de los pasos para el alta.\n\nGracias!";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

function Field({ label, children, optional }: { label: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {optional && <span className="font-normal text-slate-400">(opcional)</span>}
      </span>
      {children}
    </label>
  );
}

function MailFallback() {
  const mailto =
    `mailto:${CONTACT_EMAIL}` +
    `?subject=${encodeURIComponent(CONTACT_SUBJECT)}` +
    `&body=${encodeURIComponent(CONTACT_BODY)}`;
  return (
    <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">¿Querés que tu gimnasio esté en Habitus?</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Por el momento los gimnasios no se crean de forma automática desde la app. Escribinos por mail y
        el admin te habilitará para crear tu gimnasio. Una vez habilitado verás el formulario acá.
      </p>
      <a
        href={mailto}
        className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Mail className="h-4 w-4 mr-1.5" />
        Solicitar alta por mail
      </a>
    </div>
  );
}

export default function NuevoGimnasioPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [canCreate, setCanCreate] = useState(false);

  // form state (cuando está habilitado)
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [direccion, setDireccion] = useState("");
  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const [mapsUrl, setMapsUrl] = useState("");
  const [guardando, setGuardando] = useState(false);
  const ubicacionVerificada = direccion.trim().length >= 3 && latitud !== null && longitud !== null;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChecking(false);
      setCanCreate(false);
      return;
    }
    canCurrentUserCreateGym()
      .then(setCanCreate)
      .catch(() => setCanCreate(false))
      .finally(() => setChecking(false));
  }, [user, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim().length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres");
      return;
    }
    if (direccion.trim().length < 3) {
      toast.error("La ubicación es obligatoria: buscá y elegí la dirección real del gimnasio");
      return;
    }
    if (latitud === null || longitud === null) {
      toast.error("Elegí una sugerencia del buscador para validar la ubicación real");
      return;
    }
    setGuardando(true);
    try {
      const id = await createGym({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        instagram: instagram.trim() || null,
        website: website.trim() || null,
        direccion: direccion.trim() || null,
        maps_url: mapsUrl.trim() || null,
        latitude: latitud,
        longitude: longitud,
      });
      toast.success(`Gimnasio "${nombre.trim()}" creado — ya sos dueño y profe`);
      router.push(`/gimnasios/${id}`);
    } catch (error) {
      console.error("Error creando gimnasio:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo crear el gimnasio");
    } finally {
      setGuardando(false);
    }
  };

  if (checking || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-2xl space-y-4 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/gimnasios"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        <div className="mt-4">
          <SectionHeader
            title={canCreate ? "Crear gimnasio" : "Adherir mi gimnasio"}
            description={
              canCreate
                ? "Fuiste habilitado por el admin. Al crear quedarás como dueño y profesor del gimnasio."
                : "La creación de gimnasios está gestionada por el equipo de Habitus."
            }
          />
        </div>

        {!canCreate ? (
          <MailFallback />
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <Field label="Nombre">
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Gimnasio Central"
                maxLength={80}
                required
                className="h-11"
              />
            </Field>

            <Field label="Descripción" optional>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Qué ofrece tu gimnasio…"
                maxLength={500}
                rows={3}
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Teléfono" optional>
                <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+54 9 …" maxLength={30} className="h-11" />
              </Field>
              <Field label="Email" optional>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="contacto@gym.com" maxLength={255} className="h-11" />
              </Field>
              <Field label="Instagram" optional>
                <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@tugym o URL" maxLength={80} className="h-11" />
              </Field>
              <Field label="Sitio web" optional>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" maxLength={255} className="h-11" />
              </Field>
            </div>

            <Field label="Dirección (ubicación real)">
              <AddressAutocomplete
                value={direccion}
                verified={ubicacionVerificada}
                onTextChange={(text) => {
                  setDireccion(text);
                  setLatitud(null);
                  setLongitud(null);
                }}
                onSelect={(place) => {
                  setDireccion(place.address);
                  setLatitud(place.latitude);
                  setLongitud(place.longitude);
                }}
                required
              />
            </Field>

            <Field label="Link de Google Maps" optional>
              <Input value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.google.com/…" maxLength={500} className="h-11" />
            </Field>

            <Button type="submit" disabled={guardando} className="w-full h-11 bg-blue-600 hover:bg-blue-700">
              {guardando ? "Creando…" : "Crear gimnasio"}
            </Button>
            <p className="text-center text-xs text-slate-500">Al crear quedarás como dueño y profesor automáticamente.</p>
          </form>
        )}
      </div>
    </div>
  );
}
