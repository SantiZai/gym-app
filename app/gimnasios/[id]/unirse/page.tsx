"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getGymById, getMyGymMembership, joinGym } from "@/utils/gymUtils";
import type { Gym, GymMember } from "@/types/db";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function UnirseGymPage() {
  const params = useParams();
  const router = useRouter();
  const gymId = params.id as string;
  const { user, isLoading: authLoading } = useAuth();

  const [gym, setGym] = useState<Gym | null>(null);
  const [membership, setMembership] = useState<GymMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      const [g, m] = await Promise.all([
        getGymById(gymId),
        getMyGymMembership(user.id).catch(() => null),
      ]);
      setGym(g);
      setMembership(m);
    } catch {
      toast.error("No se pudo cargar la invitación");
      router.push("/gimnasios");
    } finally {
      setLoading(false);
    }
  }, [gymId, router, user, authLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async () => {
    setJoining(true);
    try {
      await joinGym(gymId);
      toast.success(`Te uniste a ${gym?.name}`);
      router.push(`/gimnasios/${gymId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudiste unirte");
    } finally {
      setJoining(false);
    }
  };

  if (loading || !gym) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-xl space-y-4 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const isMemberHere = membership?.gym_id === gymId;
  const memberOfOther = membership && !isMemberHere;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/gimnasios"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Gimnasios
        </Link>
        <div className="mt-4">
          <SectionHeader
            title={`Te invitaron a ${gym.name}`}
            description={gym.description ?? "Unite con el link que te compartió tu profesor."}
          />
        </div>
        <div className="mt-6 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          {isMemberHere ? (
            <>
              <p className="text-sm text-slate-600">Ya sos miembro de este gimnasio.</p>
              <Link
                href={`/gimnasios/${gymId}`}
                className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Ver mi gimnasio
              </Link>
            </>
          ) : memberOfOther ? (
            <p className="text-sm text-slate-600">
              Ya pertenecés a otro gimnasio. Salí primero para aceptar esta invitación.
            </p>
          ) : (
            <>
              <MailCheck className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-3 text-sm text-slate-600">
                Al aceptar, verás su perfil, profesores y rutinas publicadas.
              </p>
              <Button onClick={handleAccept} disabled={joining} className="mt-4 h-11 w-full bg-blue-600 hover:bg-blue-700">
                {joining ? "Uniéndote…" : "Aceptar invitación"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
