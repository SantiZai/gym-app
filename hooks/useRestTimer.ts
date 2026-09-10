"use client";
import { useEffect, useRef, useState } from "react";

export function useRestTimer() {
  const [restTime, setRestTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const intervalIdRef = useRef<number | null>(null);

  const startRestTimer = (seconds: number = 90) => {
    setRestTime(seconds);
    setIsRunning(true);
  };

  const stopRestTimer = () => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    setIsRunning(false);
    setRestTime(0);
  };

  useEffect(() => {
    if (isRunning && restTime > 0) {
      intervalIdRef.current = window.setInterval(() => {
        setRestTime((prev) => {
          if (prev <= 1) {
            if (intervalIdRef.current !== null) clearInterval(intervalIdRef.current);
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [isRunning, restTime]);

  const formatRestTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return { restTime, isRunning, startRestTimer, stopRestTimer, formatRestTime };
}
