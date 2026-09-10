export type SessionStatus = "in_progress" | "finished";

export type UnitSystem = "metric" | "imperial";

export type SerieType = "warm-up" | "normal" | "dropset" | "otro";

export interface User {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    unit: UnitSystem | null;
    created_at: string;
    updated_at: string;
    last_login: string | null;
    height: number | null;
    weight: number | null;
    goal: string | null;
}

export interface Routine {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    public: boolean;
    category: string | null;
    is_template: boolean;
    created_at: string;
    updated_at: string;
}

export interface Exercise {
    id: string;
    name: string;
    muscle: string | null;
    type: string | null;
    equipment: string | null;
    instructions: string | null;
    origin: string | null; // saber de donde viene el ejercicio
    created_at: string;
}

export interface RoutineExercise {
    id: string;
    routine_id: string;
    exercise_id: string;
    orden: number;
    notes: string | null;
}

export interface Serie {
    id: string;
    routine_exercise_id: string;
    type: SerieType;
    reps: string;
    weight: string;
    orden: number;
    notes: string | null;
}

export interface Session {
    id: string;
    user_id: string;
    routine_id: string | null; // null si la rutina fue eliminada (se conserva el historial)
    date: string;
    notes: string | null;
    started_at: string;
    ended_at: string | null;
    duration: string | null;
    status: SessionStatus;
}

export interface SessionSerie {
    id: string;
    session_id: string;
    serie_id: string | null; // puede ser null por ad-hoc series
    exercise_id: string | null; // puede ser null por ad-hoc series
    weight_used: number | null;
    reps_performed: number | null;
    completed: boolean;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    metadata: Record<string, unknown> | null;
}

// Extended type for routine exercises with nested data from joins
export interface RoutineExerciseWithDetails {
    id: string;
    orden: number;
    notes: string | null;
    exercise: Exercise;
    series: Serie[];
}