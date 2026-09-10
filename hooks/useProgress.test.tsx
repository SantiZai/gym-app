// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  getMuscleDistribution,
  getTrainingDays,
  getWeeklyStreak,
} from "@/utils/progressUtils";
import { useProgressOverview } from "./useProgress";
import type { ProgressRangeKey } from "@/types/progress";

vi.mock("@/utils/progressUtils", () => ({
  getDaySessions: vi.fn(),
  getExerciseHistory: vi.fn(),
  getMuscleDistribution: vi.fn(),
  getPersonalRecords: vi.fn(),
  getTrainingDays: vi.fn(),
  getTrainedExercises: vi.fn(),
  getVolumeHistory: vi.fn(),
  getWeeklyStreak: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTrainingDays).mockResolvedValue([{ date: "2026-09-08", count: 1 }]);
  vi.mocked(getWeeklyStreak).mockResolvedValue({ current: 1, best: 1, weeks: [] });
  vi.mocked(getMuscleDistribution).mockResolvedValue([]);
});

describe("useProgressOverview", () => {
  it("carga músculos, días y racha al montar", async () => {
    const { result } = renderHook(() => useProgressOverview("u1", "30d"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.days).toHaveLength(1);
    expect(result.current.streak?.current).toBe(1);
    expect(getMuscleDistribution).toHaveBeenCalledTimes(1);
  });

  it("al cambiar el rango recarga músculos pero NO días ni racha", async () => {
    const { result, rerender } = renderHook(
      ({ range }: { range: ProgressRangeKey }) => useProgressOverview("u1", range),
      { initialProps: { range: "30d" as ProgressRangeKey } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getTrainingDays).toHaveBeenCalledTimes(1);
    expect(getWeeklyStreak).toHaveBeenCalledTimes(1);

    rerender({ range: "90d" });
    await waitFor(() => expect(getMuscleDistribution).toHaveBeenCalledTimes(2));
    expect(getTrainingDays).toHaveBeenCalledTimes(1);
    expect(getWeeklyStreak).toHaveBeenCalledTimes(1);
    // los datos persisten, sin parpadeo de loading
    expect(result.current.loadingActivity).toBe(false);
    expect(result.current.days).toHaveLength(1);
  });

  it("limpia al desloguear", async () => {
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string | undefined }) => useProgressOverview(userId, "30d"),
      { initialProps: { userId: "u1" as string | undefined } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.days).toHaveLength(1);

    rerender({ userId: undefined });
    expect(result.current.days).toEqual([]);
    expect(result.current.streak).toBeNull();
    expect(result.current.muscles).toEqual([]);
  });
});
