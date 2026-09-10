"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getDaySessions,
  getExerciseHistory,
  getMuscleDistribution,
  getPersonalRecords,
  getTrainingDays,
  getTrainedExercises,
  getVolumeHistory,
  getWeeklyStreak,
} from "@/utils/progressUtils";
import type {
  DaySessionDetail,
  ExerciseHistoryPoint,
  MuscleSlice,
  PersonalRecord,
  ProgressRangeKey,
  StreakInfo,
  TrainedExercise,
  TrainingDay,
  VolumePoint,
} from "@/types/progress";

export function useTrainedExercises(userId: string | undefined) {
  const [data, setData] = useState<TrainedExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    getTrainedExercises(userId)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e?.message ?? "No se pudo cargar ejercicios"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId]);

  return { data, loading, error };
}

export function useExerciseHistory(userId: string | undefined, exerciseId: string | null, range: ProgressRangeKey) {
  const [data, setData] = useState<ExerciseHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || !exerciseId) {
      setData([]);
      return;
    }
    let alive = true;
    setLoading(true);
    getExerciseHistory(userId, exerciseId, range)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId, exerciseId, range]);

  return { data, loading };
}

export function useDaySessions(userId: string | undefined, dayKey: string | null) {
  const [data, setData] = useState<DaySessionDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || !dayKey) {
      setData([]);
      return;
    }
    let alive = true;
    setLoading(true);
    getDaySessions(userId, dayKey)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId, dayKey]);

  return { data, loading };
}

export function useVolumeHistory(userId: string | undefined, range: ProgressRangeKey) {
  const [data, setData] = useState<VolumePoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setData([]);
      return;
    }
    let alive = true;
    setLoading(true);
    getVolumeHistory(userId, range)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId, range]);

  return { data, loading };
}

export function usePersonalRecords(userId: string | undefined) {
  const [data, setData] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setData([]);
      return;
    }
    let alive = true;
    setLoading(true);
    getPersonalRecords(userId)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId]);

  return { data, loading };
}

export function useProgressOverview(userId: string | undefined, range: ProgressRangeKey) {
  const [muscles, setMuscles] = useState<MuscleSlice[]>([]);
  const [days, setDays] = useState<TrainingDay[]>([]);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [loadingMuscles, setLoadingMuscles] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Músculos sí dependen del rango seleccionado
  useEffect(() => {
    if (!userId) {
      setMuscles([]);
      return;
    }
    let alive = true;
    setLoadingMuscles(true);
    getMuscleDistribution(userId, range)
      .then((m) => alive && setMuscles(m))
      .catch(() => alive && setMuscles([]))
      .finally(() => alive && setLoadingMuscles(false));
    return () => {
      alive = false;
    };
  }, [userId, range]);

  // Días y racha son histórico completo: se cargan una vez por usuario
  // y persisten al cambiar de filtro para no recalcularlos
  useEffect(() => {
    if (!userId) {
      setDays([]);
      setStreak(null);
      return;
    }
    let alive = true;
    setLoadingActivity(true);
    Promise.all([getTrainingDays(userId, "all"), getWeeklyStreak(userId)])
      .then(([d, s]) => {
        if (!alive) return;
        setDays(d);
        setStreak(s);
      })
      .catch(() => {
        if (!alive) return;
        setDays([]);
        setStreak(null);
      })
      .finally(() => alive && setLoadingActivity(false));
    return () => {
      alive = false;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoadingMuscles(true);
    setLoadingActivity(true);
    try {
      const [m, d, s] = await Promise.all([
        getMuscleDistribution(userId, range),
        getTrainingDays(userId, "all"),
        getWeeklyStreak(userId),
      ]);
      setMuscles(m);
      setDays(d);
      setStreak(s);
    } finally {
      setLoadingMuscles(false);
      setLoadingActivity(false);
    }
  }, [userId, range]);

  return { muscles, days, streak, loadingMuscles, loadingActivity, loading: loadingMuscles || loadingActivity, refresh };
}
