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

export async function createRoutineBasic(payload: CreateRoutinePayload) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .rpc('create_routine_basic', { p_payload: payload });

    if (error) throw error;
    return data?.[0]?.rutina_id as string;
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
    const payload: any = {};
    
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