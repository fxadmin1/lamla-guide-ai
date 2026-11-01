"use client";

import React, { useState, useEffect } from "react";
import { Timer } from "lucide-react";

interface DashboardStudyTimerBadgeProps {
  activeSessionId?: string | null;
  userId?: string | null;
  isWindowFocused: boolean;
  totalStudyMinutes: number;
  onMinuteCompleted: (minutes: number) => void;
}

/**
 * Isolated high-performance study timer badge.
 * Self-contains high-frequency (1s) ticker updates to prevent re-rendering the root Dashboard component tree,
 * eliminating client-side UI lag, typing latency, and excessive memory allocations.
 */
export const DashboardStudyTimerBadge: React.FC<DashboardStudyTimerBadgeProps> = React.memo(({
  activeSessionId,
  userId,
  isWindowFocused,
  totalStudyMinutes,
  onMinuteCompleted,
}) => {
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [websiteSeconds, setWebsiteSeconds] = useState(0);

  // Reset session seconds when active session changes
  useEffect(() => {
    setSessionSeconds(0);
  }, [activeSessionId]);

  // Session study seconds ticker (only runs when active session is open and window is focused)
  useEffect(() => {
    if (!activeSessionId || !isWindowFocused) return;
    const interval = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSessionId, isWindowFocused]);

  // Website-wide foreground study tracker (pauses on blur / tab switch per Modern Web Guidance)
  useEffect(() => {
    if (!userId) return;

    const carryKey = `lamla_study_carry_sec_${userId}`;
    let carrySec = 0;
    try {
      const saved = localStorage.getItem(carryKey);
      if (saved) carrySec = parseInt(saved, 10) || 0;
    } catch {}

    setWebsiteSeconds(totalStudyMinutes * 60 + (carrySec % 60));

    let lastTick = performance.now();
    let accumulatedSec = carrySec % 60;

    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") {
        lastTick = performance.now();
        return;
      }

      const entries = performance.getEntriesByType("visibility-state");
      let deltaMs = 0;
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1];
        if (lastEntry.name === "visible") {
          const nowPerf = performance.now();
          deltaMs = nowPerf - Math.max(lastTick, lastEntry.startTime);
          lastTick = nowPerf;
        } else {
          lastTick = performance.now();
          return;
        }
      } else {
        const nowPerf = performance.now();
        deltaMs = nowPerf - lastTick;
        lastTick = nowPerf;
      }

      if (deltaMs >= 950) {
        accumulatedSec += 1;
        try {
          localStorage.setItem(carryKey, String(accumulatedSec));
        } catch {}

        setWebsiteSeconds((prev) => prev + 1);

        if (accumulatedSec >= 60) {
          accumulatedSec = 0;
          try {
            localStorage.setItem(carryKey, "0");
          } catch {}
          onMinuteCompleted(1);
        }
      }
    }, 1000);

    const handleVisibilityFlush = () => {
      try {
        localStorage.setItem(carryKey, String(accumulatedSec));
      } catch {}
    };

    document.addEventListener("visibilitychange", handleVisibilityFlush);
    window.addEventListener("pagehide", handleVisibilityFlush);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityFlush);
      window.removeEventListener("pagehide", handleVisibilityFlush);
    };
  }, [userId, totalStudyMinutes, onMinuteCompleted]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentDisplaySeconds = activeSessionId ? sessionSeconds : websiteSeconds;

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
        isWindowFocused
          ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
          : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400"
      }`}
      title={isWindowFocused ? "Active foreground study time" : "Study timer paused while tab or window is inactive"}
    >
      <Timer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
      <span className="font-mono">{formatTime(currentDisplaySeconds)}</span>
      {!isWindowFocused && <span className="hidden sm:inline">(Paused)</span>}
    </div>
  );
});

DashboardStudyTimerBadge.displayName = "DashboardStudyTimerBadge";
