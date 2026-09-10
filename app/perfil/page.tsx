"use client"

import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { useProgressOverview } from "@/hooks/useProgress"
import { Session } from "@/types/db"
import { getUserSessions } from "@/utils/sessionUtils"
import { useEffect, useState } from "react"
import { Check, Crown, Pencil, X } from "lucide-react"
import { TrainingCalendar } from "@/components/progreso/TrainingCalendar"
import { StreakCard } from "@/components/progreso/StreakCard"
import { updateUserProfile } from "@/utils/userUtils"
import { toast } from "sonner"

const GOALS = [
    'Ganar masa muscular',
    'Perder grasa',
    'Ganar fuerza',
    'Resistencia',
    'Mantener estado',
]

const DEFAULT_GOAL = GOALS[0]

const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
]

function formatLastSession(dateString: string | undefined): string {
    if (!dateString) return 'Sin sesiones todavía'
    const d = new Date(dateString)
    if (Number.isNaN(d.getTime())) return 'Sin sesiones todavía'
    const day = d.getDate()
    const month = monthNames[d.getMonth()]
    return `${day} de ${month}`
}

function formatHeight(altura: number): string {
    if (!altura || altura <= 0) return '—'
    // La app guarda altura en cm (ej: 181). Mostrar en metros.
    if (altura > 3) return `${(altura / 100).toFixed(2)} m`
    return `${altura} m`
}

export default function PerfilPage() {
    const { user } = useAuth();
    const { days, streak, loading: loadingProgress } = useProgressOverview(user?.id, "all")

    const [sessions, setSessions] = useState<Session[]>([])
    const [profile, setProfile] = useState<{ nombre: string, objetivo: string, altura: number, peso: number }>({
        nombre: 'Usuario',
        objetivo: DEFAULT_GOAL,
        altura: 181,
        peso: 68
    })
    const [editingGoal, setEditingGoal] = useState(false)
    const [draftGoal, setDraftGoal] = useState(DEFAULT_GOAL)
    const [savingGoal, setSavingGoal] = useState(false)
    const [editingBody, setEditingBody] = useState(false)
    const [draftPeso, setDraftPeso] = useState("")
    const [draftAltura, setDraftAltura] = useState("")
    const [savingBody, setSavingBody] = useState(false)

    useEffect(() => {
        if (user) {
            getUserSessions(user.id).then((sessions) => setSessions(sessions)).catch(() => setSessions([]))
            const goal = user.goal || DEFAULT_GOAL
            setProfile({
                nombre: user.name?.split(" ")[0] || 'Usuario',
                objetivo: goal,
                altura: user.height || 0,
                peso: user.weight || 0
            })
            setDraftGoal(goal)
        }
    }, [user])

    const saveGoal = async () => {
        if (!user) return
        setSavingGoal(true)
        try {
            await updateUserProfile(user.id, { goal: draftGoal })
            setProfile((prev) => ({ ...prev, objetivo: draftGoal }))
            setEditingGoal(false)
        } catch (error) {
            console.error("Error guardando objetivo:", error)
            toast.error("No se pudo guardar el objetivo. Intenta nuevamente.")
        } finally {
            setSavingGoal(false)
        }
    }

    const startEditingBody = () => {
        setDraftPeso(profile.peso ? String(profile.peso) : "")
        setDraftAltura(profile.altura ? String(profile.altura) : "")
        setEditingBody(true)
    }

    const saveBody = async () => {
        if (!user) return
        const peso = parseFloat(draftPeso.replace(",", "."))
        const altura = parseFloat(draftAltura.replace(",", "."))
        if (!Number.isFinite(peso) || peso < 20 || peso > 400) {
            toast.warning("Ingresa un peso válido (20 a 400 kg).")
            return
        }
        if (!Number.isFinite(altura) || altura < 100 || altura > 250) {
            toast.warning("Ingresa una altura válida en cm (100 a 250).")
            return
        }
        setSavingBody(true)
        try {
            await updateUserProfile(user.id, { weight: peso, height: altura })
            setProfile((prev) => ({ ...prev, peso, altura }))
            setEditingBody(false)
        } catch (error) {
            console.error("Error guardando estado físico:", error)
            toast.error("No se pudo guardar. Intenta nuevamente.")
        } finally {
            setSavingBody(false)
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
            <section className="mx-auto max-w-5xl space-y-6">
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <h1 className="text-3xl font-semibold text-slate-900">
                            {profile.nombre}
                        </h1>
                        <div className="rounded-3xl bg-slate-100 px-4 py-3 text-slate-700 flex gap-2 items-center">
                            <Crown className="h-5 w-5 text-blue-600 shrink-0" />
                            {editingGoal ? (
                                <>
                                    <select
                                        value={draftGoal}
                                        onChange={(e) => setDraftGoal(e.target.value)}
                                        disabled={savingGoal}
                                        className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
                                    >
                                        {GOALS.map((g) => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={saveGoal}
                                        disabled={savingGoal}
                                        title="Guardar objetivo"
                                        className="rounded-lg bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        <Check className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => { setDraftGoal(profile.objetivo); setEditingGoal(false); }}
                                        disabled={savingGoal}
                                        title="Cancelar"
                                        className="rounded-lg bg-white p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-lg font-medium">{profile.objetivo}</p>
                                    <button
                                        onClick={() => setEditingGoal(true)}
                                        title="Editar objetivo"
                                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
                    <div className="rounded-3xl bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-slate-900">
                                Estado físico
                            </h2>
                            {editingBody ? (
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={saveBody}
                                        disabled={savingBody}
                                        title="Guardar"
                                        className="rounded-lg bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        <Check className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setEditingBody(false)}
                                        disabled={savingBody}
                                        title="Cancelar"
                                        className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={startEditingBody}
                                    title="Editar peso y altura"
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                                    Peso
                                </p>
                                {editingBody ? (
                                    <div className="mt-3 flex items-center gap-2">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min={20}
                                            max={400}
                                            value={draftPeso}
                                            onChange={(e) => setDraftPeso(e.target.value)}
                                            disabled={savingBody}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-2xl font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                                        />
                                        <span className="text-sm text-slate-500">kg</span>
                                    </div>
                                ) : (
                                    <p className="mt-3 text-3xl font-semibold text-slate-900">
                                        {profile.peso ? `${profile.peso} kg` : '—'}
                                    </p>
                                )}
                            </div>
                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">
                                    Altura
                                </p>
                                {editingBody ? (
                                    <div className="mt-3 flex items-center gap-2">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min={100}
                                            max={250}
                                            value={draftAltura}
                                            onChange={(e) => setDraftAltura(e.target.value)}
                                            disabled={savingBody}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-2xl font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                                        />
                                        <span className="text-sm text-slate-500">cm</span>
                                    </div>
                                ) : (
                                    <p className="mt-3 text-3xl font-semibold text-slate-900">
                                        {formatHeight(profile.altura)}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-slate-900">
                            Resumen rápido
                        </h2>
                        <div className="mt-6 space-y-4">
                            <div className="rounded-3xl bg-slate-50 p-5">
                                <p className="text-sm text-slate-500">Racha actual</p>
                                <p className="mt-2 text-3xl font-semibold text-blue-600">
                                    {loadingProgress || !streak
                                        ? '…'
                                        : `${streak.current} ${streak.current === 1 ? 'semana' : 'semanas'}`}
                                </p>
                                {streak && streak.best > streak.current && (
                                    <p className="mt-1 text-xs text-slate-500">Récord: {streak.best} semanas</p>
                                )}
                            </div>
                            <div className="rounded-3xl bg-slate-50 p-5">
                                <p className="text-sm text-slate-500">Última sesión</p>
                                <p className="mt-2 text-lg font-medium text-slate-900">
                                    {formatLastSession(sessions[0]?.date)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-5">
                    <div className="lg:col-span-3">
                        <TrainingCalendar userId={user?.id} days={days} loading={loadingProgress} />
                    </div>
                    <div className="lg:col-span-2">
                        <StreakCard streak={streak} loading={loadingProgress} />
                    </div>
                </div>

                <div className="flex justify-center">
                    <Link
                        href="/progreso"
                        className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                        Ver análisis completo
                    </Link>
                </div>
            </section>
        </main>
    )
}
