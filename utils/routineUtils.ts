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