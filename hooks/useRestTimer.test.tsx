// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRestTimer } from "./useRestTimer";

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("useRestTimer", () => {
  it("arranca con 90s por defecto", () => {
    const { result, unmount } = renderHook(() => useRestTimer());
    act(() => result.current.startRestTimer());
    expect(result.current.restTime).toBe(90);
    expect(result.current.isRunning).toBe(true);
    unmount();
  });

  it("descuenta por timestamp aunque los ticks se salteen (background)", () => {
    const { result, unmount } = renderHook(() => useRestTimer());
    act(() => result.current.startRestTimer(60));
    // Simula background: ningún tick por 50s, luego uno solo
    act(() => vi.advanceTimersByTime(50000));
    expect(result.current.restTime).toBe(10);
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

  it("retoma un descanso persistido al remontar (salir y volver)", () => {
    const key = "habitus:rest:test-1";
    const first = renderHook(() => useRestTimer({ storageKey: key }));
    act(() => first.result.current.startRestTimer(90));
    act(() => vi.advanceTimersByTime(10000));
    first.unmount();

    // 20s después se vuelve a entrar: quedan 60s
    act(() => vi.advanceTimersByTime(20000));
    const second = renderHook(() => useRestTimer({ storageKey: key }));
    expect(second.result.current.isRunning).toBe(true);
    expect(second.result.current.restTime).toBe(60);
    second.unmount();
  });

  it("ignora un descanso persistido ya vencido", () => {
    const key = "habitus:rest:test-2";
    const first = renderHook(() => useRestTimer({ storageKey: key }));
    act(() => first.result.current.startRestTimer(10));
    first.unmount();
    act(() => vi.advanceTimersByTime(30000));
    const second = renderHook(() => useRestTimer({ storageKey: key }));
    expect(second.result.current.isRunning).toBe(false);
    expect(second.result.current.restTime).toBe(0);
    second.unmount();
  });

  it("llama onFinish una vez al terminar", () => {
    const onFinish = vi.fn();
    const { result, unmount } = renderHook(() => useRestTimer({ onFinish }));
    act(() => result.current.startRestTimer(2));
    act(() => vi.advanceTimersByTime(2000));
    expect(onFinish).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(onFinish).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("formatea mm:ss", () => {
    const { result, unmount } = renderHook(() => useRestTimer());
    expect(result.current.formatRestTime(90)).toBe("01:30");
    expect(result.current.formatRestTime(5)).toBe("00:05");
    unmount();
  });
});
