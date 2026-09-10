// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRestTimer } from "./useRestTimer";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useRestTimer", () => {
  it("arranca con 90s por defecto", () => {
    const { result, unmount } = renderHook(() => useRestTimer());
    act(() => result.current.startRestTimer());
    expect(result.current.restTime).toBe(90);
    expect(result.current.isRunning).toBe(true);
    unmount();
  });

  it("descuenta cada segundo", () => {
    const { result, unmount } = renderHook(() => useRestTimer());
    act(() => result.current.startRestTimer(60));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.restTime).toBe(55);
    expect(result.current.isRunning).toBe(true);
    unmount();
  });

  it("se detiene al llegar a cero", () => {
    const { result, unmount } = renderHook(() => useRestTimer());
    act(() => result.current.startRestTimer(3));
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.restTime).toBe(0);
    expect(result.current.isRunning).toBe(false);
    unmount();
  });

  it("stop resetea el timer", () => {
    const { result, unmount } = renderHook(() => useRestTimer());
    act(() => result.current.startRestTimer(60));
    act(() => vi.advanceTimersByTime(10000));
    act(() => result.current.stopRestTimer());
    expect(result.current.restTime).toBe(0);
    expect(result.current.isRunning).toBe(false);
    unmount();
  });

  it("formatea mm:ss", () => {
    const { result, unmount } = renderHook(() => useRestTimer());
    expect(result.current.formatRestTime(90)).toBe("01:30");
    expect(result.current.formatRestTime(5)).toBe("00:05");
    unmount();
  });
});
