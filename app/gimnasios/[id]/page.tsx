"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Dumbbell,
  Globe,
  GraduationCap,
  Instagram,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Users,
  BookmarkPlus,
  UserPlus,
  Trash2,
  Send,
  CalendarClock,
  Link2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  addGymMemberByEmail,
  assignGymRoutine,
  deleteGymRoutine,
  forkGymRoutine,
  getGymById,
  getGymMembers,
  getGymRoutines,
  getGymTrainers,
  getMyGymMembership,
  leaveGym,
  manageGymMember,
  manageGymTrainer,
  publishRoutineToGym,
  type GymRoutineItem,
} from "@/utils/gymUtils";
import { getUserRoutines } from "@/utils/routineUtils";
import type { Gym, GymMember, GymMemberWithProfile, GymTrainerWithProfile, Routine } from "@/types/db";
import { formatScheduleLines } from "@/lib/gymSchedule";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "cn";

type TabKey = "rutinas" | "profesores" | "miembros";

const TABS: { key: TabKey; label: string }[] = [
  { key: "rutinas", label: "Rutinas" },
  { key: "profesores", label: "Profesores" },
  { key: "miembros", label: "Miembros" },
];

const ROLE_LABEL: Record<string, string> = { owner: "Dueño", admin: "Admin", member: "Miembro" };

function instagramUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://instagram.com/${value.replace(/^@/, "")}`;
}

function websiteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function mapsUrlFor(gym: Gym): string | null {
  if (gym.maps_url) return gym.maps_url;
  if (gym.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gym.address)}`;
  return null;
}

export default function GimnasioPage() {
  const params = useParams();
  const router = useRouter();
  const gymId = params.id as string;
  const { user } = useAuth();

  const [gym, setGym] = useState<Gym | null>(null);
  const [members, setMembers] = useState<GymMemberWithProfile[]>([]);
  const [trainers, setTrainers] = useState<GymTrainerWithProfile[]>([]);
  const [routines, setRoutines] = useState<GymRoutineItem[]>([]);
  const [membership, setMembership] = useState<GymMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("rutinas");
  const [confirmLeave, setConfirmLeave] = useState(false);

  // v2.0: gestión
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [myRoutines, setMyRoutines] = useState<Routine[]>([]);
  const [publishId, setPublishId] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<GymRoutineItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actingMember, setActingMember] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [g, m, t, r] = await Promise.all([
        getGymById(gymId),
        getGymMembers(gymId),
        getGymTrainers(gymId),
        getGymRoutines(gymId),
      ]);
      setGym(g);
      setMembers(m);
      setTrainers(t);
      setRoutines(r);
      if (user) {
        getMyGymMembership(user.id)
          .then(setMembership)
          .catch(() => setMembership(null));
      }
    } catch (error) {
      console.error("Error cargando gimnasio:", error);
      toast.error("No se pudo cargar el gimnasio");
      router.push("/gimnasios");
    } finally {
      setLoading(false);
    }
  }, [gymId, router, user]);

  useEffect(() => {
    load();
  }, [load]);

  // Mis rutinas propias (para publicar como plantilla del gym)
  useEffect(() => {
    if (!user) return;
    getUserRoutines(user.id)
      .then((data) => setMyRoutines((data as Routine[]).filter((r) => !r.gym_id)))
      .catch(() => setMyRoutines([]));
  }, [user]);

  const isMember = membership?.gym_id === gymId;
  const myRole = isMember ? membership.role : null;
  const isAdmin = myRole === "owner" || myRole === "admin";
  const memberOfOther = membership && !isMember;
  const amTrainer = isMember && members.some((m) => m.user_id === user?.id && m.is_trainer);
  // Profe puede gestionar (agregar clientes, crear/publicar/asignar rutinas)
  const isManager = isAdmin || amTrainer;
  const myBadge = myRole === "owner" ? "Dueño" : myRole === "admin" ? "Admin" : amTrainer ? "Profesor" : "Miembro";
  const brand = gym?.primary_color ?? "#2563eb";

  const handleCopyInvite = async () => {
    const url = `${window.location.origin}/gimnasios/${gymId}/unirse`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link de invitación copiado");
    } catch {
      toast.error("No se pudo copiar el link");
    }
  };

  const handleLeave = async () => {
    if (myRole === "owner") {
      toast.error("Sos el dueño: no podés salir. Eliminá el gimnasio desde Editar.");
      setConfirmLeave(false);
      return;
    }
    try {
      await leaveGym();
      toast.success("Saliste del gimnasio");
      setConfirmLeave(false);
      setLoading(true);
      await load();
    } catch (error) {
      console.error("Error al salir:", error);
      toast.error(error instanceof Error ? error.message : "No pudiste salir del gimnasio");
    }
  };

  const handleAddByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    try {
      await addGymMemberByEmail(gymId, email);
      toast.success("Cliente agregado al gimnasio");
      setEmail("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agregar");
    } finally {
      setAdding(false);
    }
  };

  const handleFork = async (routineId: string, name: string) => {
    setForkingId(routineId);
    try {
      await forkGymRoutine(routineId);
      toast.success(`"${name}" guardada en Mis Rutinas como copia privada`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la copia");
    } finally {
      setForkingId(null);
    }
  };

  const handleAssign = async (routineId: string) => {
    const target = assignTarget[routineId];
    if (!target) {
      toast.error("Elegí un miembro para asignar");
      return;
    }
    setAssigningId(routineId);
    try {
      await assignGymRoutine(routineId, target);
      toast.success(`Rutina asignada correctamente`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo asignar");
    } finally {
      setAssigningId(null);
    }
  };

  const handlePublish = async () => {
    if (!publishId) {
      toast.error("Elegí una de tus rutinas para publicar");
      return;
    }
    setPublishing(true);
    try {
      await publishRoutineToGym(publishId, gymId);
      toast.success("Rutina publicada en la biblioteca del gimnasio");
      setPublishId("");
      setShowPublish(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo publicar");
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteRoutine = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteGymRoutine(deleteTarget.id);
      toast.success("Rutina eliminada del gimnasio (los miembros conservan sus copias)");
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const handleMemberAction = async (memberId: string, action: "make_admin" | "remove_admin" | "remove", label: string) => {
    setActingMember(memberId + action);
    try {
      await manageGymMember(gymId, memberId, action);
      toast.success(label);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar");
    } finally {
      setActingMember(null);
    }
  };

  const handleTrainerToggle = async (memberId: string, isTrainer: boolean, name: string) => {
    setActingMember(memberId + "trainer");
    try {
      await manageGymTrainer(gymId, memberId, isTrainer ? "remove" : "add");
      toast.success(isTrainer ? `${name} ya no es profesor` : `${name} ahora es profesor`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el profesor");
    } finally {
      setActingMember(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-[280px] w-full" />
        </div>
      </div>
    );
  }

  if (!gym) return null;

  const mapsUrl = mapsUrlFor(gym);

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <Link
          href="/gimnasios"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Gimnasios
        </Link>

        {/* Header del gym */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="h-2 w-full" style={{ backgroundColor: brand }} />
          <div className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {gym.logo_url ? (
              <Image
                src={gym.logo_url}
                alt={gym.name}
                width={88}
                height={88}
                className="rounded-2xl object-cover bg-slate-100 shrink-0"
                style={{ width: 88, height: 88 }}
              />
            ) : (
              <div
                className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-2xl text-3xl font-bold text-white"
                style={{ backgroundColor: brand }}
              >
                {gym.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{gym.name}</h1>
                {isMember && (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: brand }}
                  >
                    {myBadge}
                  </span>
                )}
              </div>
              {gym.description && <p className="mt-1 text-sm text-slate-600">{gym.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {members.length} {members.length === 1 ? "miembro" : "miembros"}
                </span>
                <span className="flex items-center gap-1">
                  <Dumbbell className="h-4 w-4" />
                  {routines.length} {routines.length === 1 ? "rutina" : "rutinas"}
                </span>
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" />
                  {trainers.length} {trainers.length === 1 ? "profe" : "profes"}
                </span>
              </div>
              {/* Contacto / ubicación */}
              <div className="mt-3 flex flex-wrap gap-2">
                {gym.phone && (
                  <a href={`tel:${gym.phone}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">
                    <Phone className="h-3.5 w-3.5" />
                    {gym.phone}
                  </a>
                )}
                {gym.email && (
                  <a href={`mailto:${gym.email}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">
                    <Mail className="h-3.5 w-3.5" />
                    {gym.email}
                  </a>
                )}
                {gym.instagram && (
                  <a href={instagramUrl(gym.instagram)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">
                    <Instagram className="h-3.5 w-3.5" />
                    Instagram
                  </a>
                )}
                {gym.website && (
                  <a href={websiteUrl(gym.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">
                    <Globe className="h-3.5 w-3.5" />
                    Sitio web
                  </a>
                )}
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">
                    <MapPin className="h-3.5 w-3.5" />
                    {gym.address ?? "Cómo llegar"}
                  </a>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              {isAdmin && (
                <Link
                  href={`/gimnasios/${gym.id}/editar`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Link>
              )}
              {amTrainer && (
                <Link
                  href={`/gimnasios/${gym.id}/disponibilidad`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <CalendarClock className="h-4 w-4" />
                  Mi disponibilidad
                </Link>
              )}
              {isManager && (
                <Button
                  variant="outline"
                  onClick={handleCopyInvite}
                >
                  <Link2 className="h-4 w-4 mr-1.5" />
                  Copiar invitación
                </Button>
              )}
              {isMember && myRole !== "owner" ? (
                <Button
                  variant="outline"
                  onClick={() => setConfirmLeave(true)}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  Salir
                </Button>
              ) : null}
              {!isMember ? (
                <p className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
                  {memberOfOther
                    ? "Ya pertenecés a otro gimnasio."
                    : "Solo un profesor puede agregarte."}
                </p>
              ) : null}
            </div>
          </div>
          </div>
        </div>

        {/* Ubicación */}
        {gym.address && (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Ubicación</h2>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {gym.address}
                </p>
              </div>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Cómo llegar
                </a>
              )}
            </div>
            <div className="px-5 pb-5">
              <iframe
                title={`Mapa de ${gym.name}`}
                src={
                  gym.latitude != null && gym.longitude != null
                    ? `https://maps.google.com/maps?q=${gym.latitude},${gym.longitude}&z=16&output=embed`
                    : `https://maps.google.com/maps?q=${encodeURIComponent(gym.address)}&z=15&output=embed`
                }
                className="h-64 w-full rounded-xl border border-slate-200"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              {gym.latitude != null && gym.longitude != null ? (
                <p className="mt-2 text-[11px] text-slate-400">Ubicación verificada con coordenadas.</p>
              ) : null}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === t.key ? "text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              )}
              style={tab === t.key ? { backgroundColor: brand } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "rutinas" && (
          <div className="space-y-4">
            {!isMember ? (
              <EmptyState
                title="Rutinas privadas"
                description="Solo los miembros de este gimnasio pueden ver sus rutinas. Unite para entrenar con sus rutinas y profesores."
                icon={Lock}
              />
            ) : (
              <>
            {isManager && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/gimnasios/${gym.id}/rutinas/nueva`}
                  className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: brand }}
                >
                  + Nueva rutina del gym
                </Link>
                <Button variant="outline" onClick={() => setShowPublish((v) => !v)}>
                  Publicar una de mis rutinas
                </Button>
              </div>
            )}
            {isManager && showPublish && (
              <div className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row">
                <select
                  value={publishId}
                  onChange={(e) => setPublishId(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Elegí una de tus rutinas…</option>
                  {myRoutines.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <Button onClick={handlePublish} disabled={publishing || !publishId}>
                  {publishing ? "Publicando…" : "Publicar como plantilla"}
                </Button>
              </div>
            )}
            {routines.length === 0 ? (
              <EmptyState
                title="Sin rutinas todavía"
                description="Cuando el gimnasio publique rutinas van a aparecer acá."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {routines.map((r) => (
                  <div key={r.id} className="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                    <h3 className="text-base font-semibold text-slate-900">{r.name}</h3>
                    {r.description && <p className="mt-1 text-sm text-slate-600 line-clamp-2">{r.description}</p>}
                    <p className="mt-2 text-xs text-slate-500">
                      {r.exercisesCount} {r.exercisesCount === 1 ? "ejercicio" : "ejercicios"}
                      {r.category ? ` · ${r.category}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {isMember && (
                        <Button
                          size="sm"
                          onClick={() => handleFork(r.id, r.name)}
                          disabled={forkingId === r.id}
                          className="text-white"
                          style={{ backgroundColor: brand }}
                        >
                          <BookmarkPlus className="h-4 w-4 mr-1" />
                          {forkingId === r.id ? "Guardando…" : "Guardar copia"}
                        </Button>
                      )}
                      {isManager && (
                        <Link
                          href={`/rutinas/${r.id}/editar`}
                          className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Editar
                        </Link>
                      )}
                      {isManager && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteTarget(r)}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Quitar
                        </Button>
                      )}
                    </div>
                    {isManager && (
                      <div className="mt-2 flex gap-2">
                        <select
                          value={assignTarget[r.id] ?? ""}
                          onChange={(e) => setAssignTarget((p) => ({ ...p, [r.id]: e.target.value }))}
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                        >
                          <option value="">Asignar a…</option>
                          {members.map((m) => (
                            <option key={m.user_id} value={m.user_id}>{m.name} ({ROLE_LABEL[m.role]})</option>
                          ))}
                        </select>
                        <Button size="sm" variant="outline" onClick={() => handleAssign(r.id)} disabled={assigningId === r.id}>
                          <Send className="h-3.5 w-3.5 mr-1" />
                          {assigningId === r.id ? "…" : "Asignar"}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {routines.length > 0 && (
              <p className="text-xs text-slate-500">
                Guardar crea una copia privada en tu cuenta: si el gimnasio borra la original, tu copia y tu historial quedan intactos.
              </p>
            )}
              </>
            )}
          </div>
        )}

        {tab === "profesores" && (
          trainers.length === 0 ? (
            <EmptyState
              title="Sin profesores todavía"
              description="Los profesores del gimnasio van a aparecer acá con sus horarios."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {trainers.map((t) => (
                <div key={t.id} className="flex gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  {t.avatar_url ? (
                    <Image
                      src={t.avatar_url}
                      alt={t.name}
                      width={52}
                      height={52}
                      className="rounded-full object-cover shrink-0"
                      style={{ width: 52, height: 52 }}
                    />
                  ) : (
                    <div
                      className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
                      style={{ backgroundColor: brand }}
                    >
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{t.name}</p>
                    {t.specialty && <p className="text-xs font-medium" style={{ color: brand }}>{t.specialty}</p>}
                    {(() => {
                      const lines = formatScheduleLines(t.schedule);
                      if (lines.length === 0) {
                        return <p className="mt-1 text-xs text-slate-500">Sin horarios</p>;
                      }
                      return (
                        <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                          {lines.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      );
                    })()}
                    <div className="mt-2 flex flex-wrap gap-2">
                    {t.user_id === user?.id && (
                      <Link
                        href={`/gimnasios/${gym.id}/disponibilidad`}
                        className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <CalendarClock className="h-3.5 w-3.5 mr-1" />
                        Editar disponibilidad
                      </Link>
                    )}
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        disabled={actingMember === t.user_id + "trainer"}
                        onClick={() => handleTrainerToggle(t.user_id, true, t.name)}
                      >
                        Quitar como profe
                      </Button>
                    )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "miembros" && (
          <div className="space-y-4">
            {!isMember ? (
              <EmptyState
                title="Miembros privados"
                description="Solo los miembros de este gimnasio pueden ver quiénes forman parte. Unite para ver a la comunidad del gimnasio."
                icon={Lock}
              />
            ) : (
              <>
            {isManager && (
              <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <form onSubmit={handleAddByEmail} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="cliente@mail.com — debe tener cuenta creada"
                  className="flex-1"
                />
                <Button type="submit" disabled={adding || !email.trim()} style={{ backgroundColor: brand }} className="text-white">
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  {adding ? "Agregando…" : "Agregar cliente"}
                </Button>
              </form>
              <p className="text-xs text-slate-500">
                O compartí el link de invitación (botón “Copiar invitación” arriba): el cliente crea su cuenta y acepta desde ahí.
              </p>
              </div>
            )}
            <div className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              {members.map((m) => (
                <div key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  {m.avatar_url ? (
                    <Image
                      src={m.avatar_url}
                      alt={m.name}
                      width={40}
                      height={40}
                      className="rounded-full object-cover shrink-0"
                      style={{ width: 40, height: 40 }}
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{m.name}</p>
                  {m.is_trainer && (
                    <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                      Profesor
                    </span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                  {(() => {
                    const isSelf = m.user_id === user?.id;
                    const isOwnerRow = m.role === "owner";
                    // Ser profe es una ficha aparte del rol: el dueño también
                    // puede ser profesor (solo owner/admin gestiona profes,
                    // incluso a sí mismo). Expulsar/cambiar roles sigue
                    // bloqueado para uno mismo y para el dueño.
                    const canToggleTrainer = isAdmin;
                    const canManageRole =
                      isManager && !isSelf && !isOwnerRow;
                    if (!canToggleTrainer && !canManageRole) return null;
                    return (
                    <div className="flex flex-wrap gap-1">
                      {canToggleTrainer && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actingMember === m.user_id + "trainer"}
                          onClick={() => handleTrainerToggle(m.user_id, m.is_trainer, m.name)}
                        >
                          {m.is_trainer ? "Quitar profe" : "Hacer profe"}
                        </Button>
                      )}
                      {canManageRole && (
                        <>
                      {isAdmin && m.role === "member" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actingMember === m.user_id + "make_admin"}
                          onClick={() => handleMemberAction(m.user_id, "make_admin", `${m.name} ahora es admin`)}
                        >
                          Hacer admin
                        </Button>
                      )}
                      {myRole === "owner" && m.role === "admin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actingMember === m.user_id + "remove_admin"}
                          onClick={() => handleMemberAction(m.user_id, "remove_admin", `${m.name} volvió a miembro`)}
                        >
                          Quitar admin
                        </Button>
                      )}
                      {(isAdmin || (amTrainer && m.role === "member")) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          disabled={actingMember === m.user_id + "remove"}
                          onClick={() => handleMemberAction(m.user_id, "remove", `${m.name} eliminado del gym`)}
                        >
                          Quitar
                        </Button>
                      )}
                        </>
                      )}
                    </div>
                    );
                  })()}
                </div>
              ))}
            </div>
              </>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmLeave}
        title="Salir del gimnasio"
        description="Vas a dejar de ver sus rutinas y profesores en tu cuenta. Podés volver cuando quieras."
        confirmLabel="Sí, salir"
        onConfirm={handleLeave}
        onCancel={() => setConfirmLeave(false)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Quitar rutina del gimnasio"
        description={`"${deleteTarget?.name}" dejará de estar en la biblioteca. Los miembros conservan sus copias privadas y su historial.`}
        confirmLabel="Sí, quitar"
        busy={deleting}
        onConfirm={handleDeleteRoutine}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
