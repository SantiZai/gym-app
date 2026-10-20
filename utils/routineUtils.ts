import type { Exercise, Routine, SerieType } from "@/types/db";
import type {
    EditableExercise,
    EditableSerie,
    RoutinePayload,
} from "@/types/routine";
import { createClient } from "./supabase/client";

type RutinaEjercicioInput = {
    ejercicio_id: string;
    orden?: number;
    notas?: string | null;
};

type CreateRoutinePayload = {
    nombre: string;
    descripcion?: string | null;
    publica?: boolean;
    ejercicios: RutinaEjercicioInput[];
};

export async function getUserRoutines(userId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from("routines")
        .select("*")
        .eq("user_id", userId)
        // Las rutinas de gimnasio (gym_id seteado) viven en la biblioteca del
        // gym, no en "Mis Rutinas". Sin este filtro, publicar una rutina propia
        // al gym duplicaba visualmente la rutina en la pestaña personal porque
        // la copia del gym sigue teniendo user_id = el profesor.
        .is("gym_id", null)

    if (error) throw error;
    return data;
}

export async function getRoutineById(routineId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from("routines")
        .select("*")
        .eq("id", routineId)
        .single()

    if (error) throw error;
    return data;
}

export async function getRoutineExercises(routineId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from("routine_exercises")
        .select("*")
        .eq("routine_id", routineId)
        .order("orden", { ascending: true })

    if (error) throw error;
    return data;
}

/** Intento rápido y silencioso de leer el id del RPC (array u objeto). */
export function tryExtractRutinaId(data: unknown): string | null {
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const id = (rows[0] as { rutina_id?: unknown } | undefined)?.rutina_id;
    if (typeof id === "string" && id.length > 0) return id;
    try {
        const parsed: unknown = JSON.parse(JSON.stringify(data));
        const rows2 = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
        const id2 = (rows2[0] as { rutina_id?: unknown } | undefined)?.rutina_id;
        if (typeof id2 === "string" && id2.length > 0) return id2;
    } catch {
        // ignorar y caer al lookup
    }
    return null;
}

export function extractRutinaId(data: unknown): string {
    const id = tryExtractRutinaId(data);
    if (!id) throw new Error("La rutina no devolvió identificador");
    return id;
}

export async function createRoutineBasic(payload: CreateRoutinePayload) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .rpc('create_routine_basic', { p_payload: payload });

    if (error) throw error;

    // Vía rápida: id en la respuesta del RPC
    const fast = tryExtractRutinaId(data);
    if (fast) return fast;

    // Fallback: la rutina ya fue creada por el RPC; buscar la más reciente
    // del usuario con ese nombre (cubre respuestas que no se pueden parsear)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("La rutina no devolvió identificador");
    const since = new Date(Date.now() - 120_000).toISOString();
    const { data: found, error: findError } = await supabase
        .from("routines")
        .select("id")
        .eq("user_id", user.id)
        .is("gym_id", null)
        .eq("name", payload.nombre)
        .gt("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (findError) throw findError;
    if (!found) throw new Error("La rutina no devolvió identificador");
    return found.id as string;
}

// Obtener series de un routine_exercise
export async function getSeriesByRoutineExerciseId(routineExerciseId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("series")
        .select("*")
        .eq("routine_exercise_id", routineExerciseId)
        .order("orden", { ascending: true });

    if (error) throw error;
    return data || [];
}

// Obtener todas las series de una rutina (agrupadas por routine_exercise_id)
export async function getSeriesByRoutineId(routineId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("series")
        .select(`
            *,
            routine_exercises!inner(
                routine_id
            )
        `)
        .eq("routine_exercises.routine_id", routineId)
        .order("orden", { ascending: true });

    if (error) throw error;
    return data || [];
}

// Actualizar información básica de la rutina
export async function updateRoutine(routineId: string, updates: { name?: string; description?: string | null; public?: boolean }) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("routines")
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq("id", routineId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Crear routine_exercise
export async function createRoutineExercise(routineId: string, exerciseId: string, orden: number, notes: string | null = null) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("routine_exercises")
        .insert({
            routine_id: routineId,
            exercise_id: exerciseId,
            orden,
            notes
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Actualizar routine_exercise
export async function updateRoutineExercise(routineExerciseId: string, updates: { orden?: number; notes?: string | null }) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("routine_exercises")
        .update(updates)
        .eq("id", routineExerciseId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Eliminar routine_exercise (las series se eliminan en cascada)
export async function deleteRoutineExercise(routineExerciseId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("routine_exercises")
        .delete()
        .eq("id", routineExerciseId);

    if (error) throw error;
}

// Crear serie
export async function createSerie(routineExerciseId: string, serie: {
    type: string;
    reps: string;
    weight: string;
    orden: number;
    notes: string | null;
}) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("series")
        .insert({
            routine_exercise_id: routineExerciseId,
            type: serie.type,
            reps: parseInt(serie.reps) || 0,
            weight: parseFloat(serie.weight) || null,
            orden: serie.orden,
            notes: serie.notes
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Actualizar serie
export async function updateSerie(serieId: string, updates: {
    type?: string;
    reps?: string;
    weight?: string;
    orden?: number;
    notes?: string | null;
}) {
    const supabase = await createClient();
    const payload: { type?: string; reps?: number; weight?: number | null; orden?: number; notes?: string | null } = {};
    
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.reps !== undefined) payload.reps = parseInt(updates.reps) || 0;
    if (updates.weight !== undefined) payload.weight = parseFloat(updates.weight) || null;
    if (updates.orden !== undefined) payload.orden = updates.orden;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { data, error } = await supabase
        .from("series")
        .update(payload)
        .eq("id", serieId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Eliminar serie
export async function deleteSerie(serieId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("series")
        .delete()
        .eq("id", serieId);

    if (error) throw error;
}

// Eliminar rutina PERSONAL (ejercicios, series y sesiones se eliminan en cascada)
// Las rutinas de gimnasio (gym_id NOT NULL) NO se pueden borrar desde acá:
// solo desde la administración del gym (deleteGymRoutine). Sin esta guarda,
// borrar la "copia" que se veía en Mis Rutinas borraba también la del gym
// porque era la misma fila.
export async function deleteRoutine(routineId: string) {
    const supabase = await createClient();

    const { data: existing, error: checkError } = await supabase
        .from("routines")
        .select("id,gym_id")
        .eq("id", routineId)
        .maybeSingle();

    if (checkError) throw checkError;
    if (existing && (existing as { gym_id: string | null }).gym_id) {
        throw new Error("Esta rutina es del gimnasio. Eliminala desde la administración del gimnasio.");
    }

    const { error, count } = await supabase
        .from("routines")
        .delete({ count: "exact" })
        .eq("id", routineId)
        .is("gym_id", null);

    if (error) throw error;
    if (count === 0) {
        throw new Error("No se pudo eliminar la rutina. Si es del gimnasio, eliminala desde la administración del gimnasio.");
    }
}

// Eliminar múltiples series
export async function deleteMultipleSeries(serieIds: string[]) {
    if (serieIds.length === 0) return;
    
    const supabase = await createClient();
    const { error } = await supabase
        .from("series")
        .delete()
        .in("id", serieIds);

    if (error) throw error;
}

type RawSerieRow = {
    id: string;
    type: string;
    reps: number | string | null;
    weight: number | string | null;
    orden: number;
    notes: string | null;
};

type RawRoutineExerciseRow = {
    id: string;
    orden: number;
    notes: string | null;
    exercise: Exercise | Exercise[] | null;
    series: RawSerieRow[] | null;
};

type RoutineExerciseRowRef = {
    id: string;
    exercise_id: string;
    orden: number;
};

export async function getRoutineFull(
    routineId: string
): Promise<{ routine: Routine; exercises: EditableExercise[] }> {
    const supabase = await createClient();

    const [routineRes, exercisesRes] = await Promise.all([
        supabase.from("routines").select("*").eq("id", routineId).single(),
        supabase
            .from("routine_exercises")
            .select(`
                id,
                orden,
                notes,
                exercise:exercises (
                    id,
                    name,
                    primary_muscle_id,
                    secondary_muscle_ids,
                    type,
                    equipment,
                    instructions,
                    origin,
                    created_at
                ),
                series (
                    id,
                    type,
                    reps,
                    weight,
                    orden,
                    notes
                )
            `)
            .eq("routine_id", routineId)
            .order("orden", { ascending: true }),
    ]);

    if (routineRes.error) throw routineRes.error;
    if (exercisesRes.error) throw exercisesRes.error;

    const rows = (exercisesRes.data ?? []) as unknown as RawRoutineExerciseRow[];

    const exercises = rows
        .map((row) => {
            const exercise = Array.isArray(row.exercise) ? row.exercise[0] : row.exercise;
            if (!exercise) return null;

            const mapped: EditableExercise = {
                exercise_id: exercise.id,
                name: exercise.name,
                primary_muscle_id: exercise.primary_muscle_id,
                secondary_muscle_ids: exercise.secondary_muscle_ids ?? [],
                type: exercise.type,
                equipment: exercise.equipment,
                instructions: exercise.instructions,
                routine_exercise_id: row.id,
                orden: row.orden,
                notes: row.notes,
                series: [...(row.series ?? [])]
                    .sort((a, b) => a.orden - b.orden)
                    .map<EditableSerie>((serie) => ({
                        id: serie.id,
                        type: (serie.type as SerieType) ?? "normal",
                        reps: serie.reps == null ? "" : String(serie.reps),
                        weight: serie.weight == null ? "" : String(serie.weight),
                        orden: serie.orden,
                        notes: serie.notes,
                    })),
            };

            return mapped;
        })
        .filter((item): item is EditableExercise => item !== null);

    return { routine: routineRes.data as Routine, exercises };
}

export interface SaveRoutineInput {
    routineId: string | null;
    payload: RoutinePayload;
    removedRoutineExerciseIds?: string[];
    removedSerieIds?: string[];
}

export async function saveRoutineFull(input: SaveRoutineInput): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_routine_full", {
        p_routine_id: input.routineId,
        p_payload: input.payload,
    });

    if (!error) {
        const returnedId = extractRoutineIdFromRpc(data);
        if (returnedId) return returnedId;
        if (input.routineId) return input.routineId;
        throw new Error("La rutina no devolvió identificador");
    }

    if (!isMissingFunctionError(error)) throw error;
    return saveRoutineFallback(input);
}

function extractRoutineIdFromRpc(data: unknown): string | null {
    if (typeof data === "string" && data.length > 0) return data;

    const rows = Array.isArray(data) ? data : data ? [data] : [];
    for (const row of rows) {
        if (typeof row === "string" && row.length > 0) return row;
        if (row && typeof row === "object") {
            const values = Object.values(row as Record<string, unknown>);
            const found = values.find((value): value is string => typeof value === "string" && value.length > 0);
            if (found) return found;
        }
    }

    return null;
}

function isMissingFunctionError(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false;
    const message = (error.message ?? "").toLowerCase();
    return (
        error.code === "PGRST202" ||
        error.code === "42883" ||
        message.includes("could not find the function") ||
        message.includes("save_routine_full")
    );
}

function randomUuid(): string {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
        return cryptoApi.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16);
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
    });
}

type PayloadSerie = RoutinePayload["ejercicios"][number]["series"][number];

function buildSerieRow(serie: PayloadSerie, routineExerciseId: string) {
    const weight = Number.parseFloat(serie.weight);
    const reps = Number.parseInt(serie.reps, 10);

    return {
        id: serie.serie_id ?? randomUuid(),
        routine_exercise_id: routineExerciseId,
        type: serie.type,
        reps: Number.isFinite(reps) ? reps : 0,
        weight: Number.isFinite(weight) ? weight : null,
        orden: serie.orden,
        notes: serie.notes,
    };
}

async function saveRoutineFallback(input: SaveRoutineInput): Promise<string> {
    const supabase = await createClient();
    const { payload } = input;

    if (!input.routineId) {
        const routineId = await createRoutineBasic({
            nombre: payload.nombre,
            descripcion: payload.descripcion,
            publica: payload.publica,
            ejercicios: payload.ejercicios.map((exercise) => ({
                ejercicio_id: exercise.ejercicio_id,
                orden: exercise.orden,
                notas: exercise.notas,
            })),
        });

        const created = (await getRoutineExercises(routineId)) as RoutineExerciseRowRef[];
        const byKey = new Map(
            created.map((row) => [`${row.exercise_id}|${row.orden}`, row.id])
        );

        const serieRows = payload.ejercicios.flatMap((exercise) => {
            const routineExerciseId = byKey.get(`${exercise.ejercicio_id}|${exercise.orden}`);
            if (!routineExerciseId) return [];
            return exercise.series.map((serie) => buildSerieRow(serie, routineExerciseId));
        });

        if (serieRows.length > 0) {
            const { error } = await supabase.from("series").insert(serieRows);
            if (error) throw error;
        }

        return routineId;
    }

    const routineId = input.routineId;

    await updateRoutine(routineId, {
        name: payload.nombre,
        description: payload.descripcion,
        public: payload.publica,
    });

    const routineExerciseRows = payload.ejercicios.map((exercise) => ({
        id: exercise.routine_exercise_id ?? randomUuid(),
        routine_id: routineId,
        exercise_id: exercise.ejercicio_id,
        orden: exercise.orden,
        notes: exercise.notas,
    }));

    if (routineExerciseRows.length > 0) {
        const { error } = await supabase
            .from("routine_exercises")
            .upsert(routineExerciseRows, { onConflict: "id" });
        if (error) throw error;
    }

    const serieRows = payload.ejercicios.flatMap((exercise, index) =>
        exercise.series.map((serie) => buildSerieRow(serie, routineExerciseRows[index].id))
    );

    if (serieRows.length > 0) {
        const { error } = await supabase
            .from("series")
            .upsert(serieRows, { onConflict: "id" });
        if (error) throw error;
    }

    const currentRoutineExerciseIds = new Set(routineExerciseRows.map((row) => row.id));
    const removedRoutineExerciseIds = (input.removedRoutineExerciseIds ?? []).filter(
        (id) => !currentRoutineExerciseIds.has(id)
    );

    if (removedRoutineExerciseIds.length > 0) {
        const { error } = await supabase
            .from("routine_exercises")
            .delete()
            .in("id", removedRoutineExerciseIds);
        if (error) throw error;
    }

    const currentSerieIds = new Set(serieRows.map((row) => row.id));
    const removedSerieIds = (input.removedSerieIds ?? []).filter(
        (id) => !currentSerieIds.has(id)
    );

    if (removedSerieIds.length > 0) {
        const { error } = await supabase.from("series").delete().in("id", removedSerieIds);
        if (error) throw error;
    }

    return routineId;
}