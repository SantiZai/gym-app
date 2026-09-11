export type ProgressRangeKey = "week" | "30d" | "90d" | "all";

export interface ExerciseHistoryPoint {
  date: string; // ISO
  sessionId: string;
  weight: number | null;
  reps: number | null;
  volume: number; // weight * reps (0 si falta dato)
  e1rm: number | null; // Epley
}

export interface TrainedExercise {
  id: string;
  name: string;
  muscle: string | null;
  sessionsCount: number;
  lastDate: string | null;
}

export interface MuscleSlice {
  group: string;
  series: number;
  volume: number;
  sessions: number;
}

export interface TrainingDay {
  date: string; // yyyy-mm-dd
  count: number;
}

export interface WeekStreak {
  weekStart: string; // yyyy-mm-dd del lunes
  trained: boolean;
}

export interface StreakInfo {
  current: number;
  best: number;
  weeks: WeekStreak[];
}

export type ExerciseMetricKey = "e1rm" | "maxWeight" | "volume";

export interface DaySessionDetail {
  sessionId: string;
  date: string; // ISO
  routineId: string | null;
  routineName: string;
  seriesCount: number;
  exercisesCount: number;
  volume: number; // kg totales
}

export interface VolumePoint {
  date: string; // yyyy-mm-dd
  volume: number; // kg totales del día
  sessions: number;
}

export interface PersonalRecord {
  exerciseId: string;
  name: string;
  muscle: string | null;
  bestE1rm: number;
  bestWeight: number | null;
  bestReps: number | null;
  achievedAt: string; // ISO
}

export interface SessionSummary {
  sessionId: string;
  startedAt: string | null;
  endedAt: string | null;
  durationLabel: string;
  totalSeriesCompleted: number;
  totalVolume: number; // kg
}
