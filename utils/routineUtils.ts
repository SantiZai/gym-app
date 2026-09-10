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

// Eliminar rutina (ejercicios, series y sesiones se eliminan en cascada)
export async function deleteRoutine(routineId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("routines")
        .delete()
        .eq("id", routineId);

    if (error) throw error;
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