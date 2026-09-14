export type SessionStatus = "in_progress" | "finished";

export type UnitSystem = "metric" | "imperial";

export type SerieType = "warm-up" | "normal" | "dropset" | "otro";

export interface User {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    unit: UnitSystem | null;
    gym_id: string | null; // null = sin gimnasio (v2)
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
    gym_id: string | null; // seteado = biblioteca del gym (v2)
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

// v2: gimnasios
export type GymMemberRole = "owner" | "admin" | "member";

export interface Gym {
    id: string;
    name: string;
    description: string | null;
    logo_url: string | null;
    primary_color: string | null; // hex #RRGGBB, null = default app
    phone: string | null;
    email: string | null;
    instagram: string | null;
    website: string | null;
    address: string | null;
    maps_url: string | null;
    latitude: number | null; // coords del buscador de lugares (null = solo texto)
    longitude: number | null;
    created_by: string | null;
    created_at: string;
}

export interface GymMember {
    gym_id: string;
    user_id: string;
    role: GymMemberRole;
    joined_at: string;
}

// Horario semanal de un profesor: [{day: 0-6 (0=domingo), start: "08:00", end: "12:00"}]
export interface TrainerScheduleEntry {
    day: number;
    start: string;
    end: string;
}

export interface GymTrainer {
    id: string;
    gym_id: string;
    user_id: string;
    specialty: string | null;
    schedule: TrainerScheduleEntry[];
    created_at: string;
}

// Profesor con datos de su perfil público (vista public_profiles)
export interface GymTrainerWithProfile extends GymTrainer {
    name: string;
    avatar_url: string | null;
}

// Miembro con datos de perfil público
export interface GymMemberWithProfile extends GymMember {
    name: string;
    avatar_url: string | null;
    is_trainer: boolean;
}