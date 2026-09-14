"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteGym,
  getGymById,
  getMyGymMembership,
  normalizeHexColor,
  updateGym,
  uploadGymLogo,
} from "@/utils/gymUtils";
import type { Gym } from "@/types/db";
import { AddressAutocomplete } from "@/components/shared/AddressAutocomplete";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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

export default function EditarGimnasioPage() {
  const params = useParams();
  const router = useRouter();
  const gymId = params.id as string;
  const { user, isLoading: authLoading } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [gym, setGym] = useState<Gym | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [direccion, setDireccion] = useState("");
  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const [mapsUrl, setMapsUrl] = useState("");
  const direccionVerificada = direccion.trim().length >= 3 && latitud !== null && longitud !== null;

  const load = useCallback(async () => {
    // Esperar a que resuelva la sesión: si no, el dueño es rebotado
    // como "no admin" en el primer render (user todavía null).
    if (authLoading) return;
    if (!user) {
      toast.error("Iniciá sesión para editar");
      router.push(`/gimnasios/${gymId}`);
      return;
    }
    try {
      const [g, m] = await Promise.all([
        getGymById(gymId),
        getMyGymMembership(user.id),
      ]);
      const role = m && m.gym_id === gymId ? m.role : null;
      if (role !== "owner" && role !== "admin") {
        toast.error("Solo administradores del gimnasio");
        router.push(`/gimnasios/${gymId}`);
        return;
      }
      setGym(g);
      setMyRole(role);
      setNombre(g.name);
      setDescripcion(g.description ?? "");
      setColor(g.primary_color ?? "#2563eb");
      setTelefono(g.phone ?? "");
      setEmail(g.email ?? "");
      setInstagram(g.instagram ?? "");
      setWebsite(g.website ?? "");
      setDireccion(g.address ?? "");
      setLatitud(g.latitude ?? null);
      setLongitud(g.longitude ?? null);
      setMapsUrl(g.maps_url ?? "");
    } catch (error) {
      console.error("Error cargando gimnasio:", error);
      toast.error("No se pudo cargar el gimnasio");
      router.push("/gimnasios");
    } finally {
      setLoading(false);
    }
  }, [gymId, router, user, authLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
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
      const normalized = normalizeHexColor(color);
      const updated = await updateGym(gymId, {
        name: nombre.trim(),
        description: descripcion.trim() || null,
        primary_color: normalized,
        phone: telefono.trim() || null,
        email: email.trim() || null,
        instagram: instagram.trim() || null,
        website: website.trim() || null,
        address: direccion.trim() || null,
        latitude: latitud,
        longitude: longitud,
        maps_url: mapsUrl.trim() || null,
      });
      setGym(updated);
      toast.success("Gimnasio actualizado");
      router.push(`/gimnasios/${gymId}`);
    } catch (error) {
      console.error("Error actualizando:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo guardar (la dirección es obligatoria)");
    } finally {
      setGuardando(false);
    }
  };

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendoLogo(true);
    try {
      const url = await uploadGymLogo(gymId, file);
      setGym((prev) => (prev ? { ...prev, logo_url: url } : prev));
      toast.success("Logo actualizado");
    } catch (error) {
      console.error("Error subiendo logo:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo subir el logo");
    } finally {
      setSubiendoLogo(false);
    }
  };

  const handleDelete = async () => {
    if (myRole !== "owner") {
      toast.error("Solo el dueño puede eliminar el gimnasio");
      setConfirmDelete(false);
      return;
    }
    setEliminando(true);
    try {
      await deleteGym(gymId);
      toast.success("Gimnasio eliminado");
      router.push("/gimnasios");
    } catch (error) {
      console.error("Error eliminando:", error);
      toast.error("No se pudo eliminar (solo el dueño puede)");
      setEliminando(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-2xl space-y-4 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!gym) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <Link
          href={`/gimnasios/${gymId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al gimnasio
        </Link>

        <div className="mt-4">
          <SectionHeader title="Editar gimnasio" description="Información pública, logo y zona de peligro." />
        </div>

        {/* Logo */}
        <div className="mt-6 flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {gym.logo_url ? (
            <Image
              src={gym.logo_url}
              alt={gym.name}
              width={72}
              height={72}
              className="rounded-xl object-cover bg-slate-100"
              style={{ width: 72, height: 72 }}
            />
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-blue-100 text-2xl font-bold text-blue-700">
              {gym.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-900">Logo</p>
            <p className="text-xs text-slate-500">Imagen cuadrada, máx 2 MB.</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={subiendoLogo}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              {subiendoLogo ? "Subiendo…" : "Cambiar logo"}
            </Button>
          </div>
        </div>

        {/* Datos */}
        <form onSubmit={handleSave} className="mt-4 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <Field label="Nombre">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} required className="h-11" />
          </Field>
          <Field label="Color de marca">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={normalizeHexColor(color) ?? "#2563eb"}
                onChange={(e) => setColor(e.target.value)}
                className="h-11 w-16 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#2563eb"
                maxLength={7}
                className="h-11 flex-1 font-mono"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Se usa en el header, insignias y botones del perfil del gym.</p>
          </Field>
          <Field label="Descripción" optional>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={500} rows={3} className={inputClass} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Teléfono" optional>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={30} className="h-11" />
            </Field>
            <Field label="Email" optional>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={255} className="h-11" />
            </Field>
            <Field label="Instagram" optional>
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} maxLength={80} className="h-11" />
            </Field>
            <Field label="Sitio web" optional>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={255} className="h-11" />
            </Field>
          </div>
          <Field label="Dirección (ubicación real)">
            <AddressAutocomplete
              value={direccion}
              verified={direccionVerificada}
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
            <Input value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} maxLength={500} className="h-11" />
          </Field>
          <Button type="submit" disabled={guardando} className="w-full h-11 bg-blue-600 hover:bg-blue-700">
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>

        {/* Zona de peligro: solo el dueño puede eliminar */}
        {myRole === "owner" ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-red-700">Zona de peligro</h2>
          <p className="mt-1 text-xs text-slate-500">
            Solo el dueño puede eliminar. Se borra la biblioteca de rutinas del gym; los
            miembros conservan sus copias y su historial.
          </p>
          <Button
            variant="outline"
            className="mt-3 border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Eliminar gimnasio
          </Button>
        </div>
        ) : (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-900">Eliminar gimnasio</h2>
          <p className="mt-1 text-xs text-slate-500">
            Solo el dueño puede eliminar el gimnasio. Si sos administrador y querés salir,
            hacelo desde el perfil del gimnasio con el botón Salir.
          </p>
        </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar gimnasio"
        description="Se eliminará el gimnasio y su biblioteca de rutinas. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        busy={eliminando}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
