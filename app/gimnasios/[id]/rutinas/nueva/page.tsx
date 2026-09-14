"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createGymRoutine } from "@/utils/gymUtils";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

export default function NuevaRutinaGymPage() {
  const params = useParams();
  const router = useRouter();
  const gymId = params.id as string;

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim().length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres");
      return;
    }
    setGuardando(true);
    try {
      const id = await createGymRoutine(gymId, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        categoria: categoria.trim() || null,
      });
      toast.success("Rutina del gimnasio creada, ahora agregá ejercicios");
      router.push(`/rutinas/${id}/editar`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la rutina");
    } finally {
      setGuardando(false);
    }
  };

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
          <SectionHeader
            title="Nueva rutina del gimnasio"
            description="Se publica en la biblioteca del gym. Los miembros la verán y podrán guardar una copia privada."
          />
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nombre</span>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Fuerza inicial" maxLength={80} required className="h-11" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Descripción <span className="font-normal text-slate-400">(opcional)</span></span>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="A quién está dirigida, nivel…" maxLength={500} rows={3} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Categoría <span className="font-normal text-slate-400">(opcional)</span></span>
            <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Fuerza, Hipertrofia…" maxLength={50} className="h-11" />
          </label>
          <Button type="submit" disabled={guardando} className="h-11 w-full bg-blue-600 hover:bg-blue-700">
            {guardando ? "Creando…" : "Crear y agregar ejercicios"}
          </Button>
        </form>
      </div>
    </div>
  );
}
