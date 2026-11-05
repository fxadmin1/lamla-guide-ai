"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronUp, ChevronDown, GripVertical, GripHorizontal } from "lucide-react";

interface FastScrollHandleProps {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  label?: string;
  orientation?: "vertical" | "horizontal";
  side?: "left" | "right";
  onProgressChange?: (pct: number) => void;
}

export default function FastScrollHandle({
  scrollContainerRef,
  label = "Fast Scroll",
  orientation = "vertical",
  side = "right",
  onProgressChange,
}: FastScrollHandleProps) {
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const updateProgressState = useCallback(
    (pct: number) => {
      const clamped = Math.min(100, Math.max(0, pct));
      setProgress(clamped);
      if (onProgressChange) {
        onProgressChange(Math.round(clamped));
      }
    },
    [onProgressChange]
  );

  const computeScrollProgress = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el && el.scrollHeight > el.clientHeight + 16) {
      const maxScroll = el.scrollHeight - el.clientHeight;
      const pct = maxScroll > 0 ? (el.scrollTop / maxScroll) * 100 : 0;
      updateProgressState(pct);
      return;
    }
    if (typeof window !== "undefined") {
      const doc = document.documentElement;
      const maxWin = doc.scrollHeight - window.innerHeight;
      const pct = maxWin > 0 ? (window.scrollY / maxWin) * 100 : 0;
      updateProgressState(pct);
    }
  }, [scrollContainerRef, updateProgressState]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    const onScroll = () => {
      if (!isDragging) {
        computeScrollProgress();
      }
    };
    if (el) {
      el.addEventListener("scroll", onScroll, { passive: true });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    computeScrollProgress();

    const timer = setTimeout(computeScrollProgress, 250);
    return () => {
      clearTimeout(timer);
      if (el) {
        el.removeEventListener("scroll", onScroll);
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [scrollContainerRef, isDragging, computeScrollProgress]);

  const scrollToRatio = useCallback(
    (ratio: number) => {
      const clamped = Math.min(1, Math.max(0, ratio));
      updateProgressState(clamped * 100);

      const el = scrollContainerRef.current;
      if (el && el.scrollHeight > el.clientHeight + 16) {
        const maxScroll = el.scrollHeight - el.clientHeight;
        el.scrollTop = clamped * maxScroll;
        return;
      }
      if (typeof window !== "undefined") {
        const doc = document.documentElement;
        const maxWin = doc.scrollHeight - window.innerHeight;
        window.scrollTo({ top: clamped * maxWin, behavior: "auto" });
      }
    },
    [scrollContainerRef, updateProgressState]
  );

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      if (orientation === "horizontal") {
        if (rect.width <= 0) return;
        const ratio = (clientX - rect.left) / rect.width;
        scrollToRatio(ratio);
      } else {
        if (rect.height <= 0) return;
        const ratio = (clientY - rect.top) / rect.height;
        scrollToRatio(ratio);
      }
    },
    [orientation, scrollToRatio]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  if (orientation === "horizontal") {
    return (
      <div
        className="print:hidden select-none w-full space-y-1.5"
        aria-label={label}
        title="Hold and drag left or right to scroll fast or slowly"
      >
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
            <GripHorizontal className="w-3.5 h-3.5" />
            <span>Hold &amp; drag bar to scroll</span>
          </span>
          <span className="tabular-nums font-bold text-blue-600 dark:text-blue-400">
            {Math.round(progress)}% read
          </span>
        </div>

        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative w-full h-7 flex items-center cursor-grab active:cursor-grabbing touch-none"
        >
          {/* Background Horizontal Rail */}
          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Draggable Horizontal Thumb */}
          <div
            style={{ left: `calc(${progress}% - 16px)` }}
            className={`absolute top-1/2 -translate-y-1/2 w-8 h-5 rounded-full flex items-center justify-center shadow-md border transition-transform ${
              isDragging
                ? "scale-115 bg-blue-700 text-white border-blue-300 ring-4 ring-blue-500/25"
                : "bg-blue-600 hover:bg-blue-700 text-white border-blue-400"
            }`}
          >
            <GripHorizontal className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="print:hidden select-none flex flex-col items-center gap-1.5 py-2 px-1.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-lg backdrop-blur-xs z-30"
      aria-label={label}
      title="Hold and drag the handle up or down to scroll fast or slowly"
    >
      {/* Top Quick-Jump Button */}
      <button
        type="button"
        onClick={() => scrollToRatio(0)}
        className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-slate-600 hover:text-blue-600 dark:text-slate-300 transition-colors"
        title="Jump to top"
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      {/* Percentage Readout */}
      <span className="text-[10px] font-bold tabular-nums text-blue-600 dark:text-blue-400">
        {Math.round(progress)}%
      </span>

      {/* Interactive Vertical Drag Track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-7 h-44 sm:h-56 flex justify-center cursor-grab active:cursor-grabbing touch-none py-2"
      >
        {/* Background Rail */}
        <div className="w-2.5 h-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden relative">
          <div
            className="w-full bg-blue-600 dark:bg-blue-500 rounded-full transition-none"
            style={{ height: `${progress}%` }}
          />
        </div>

        {/* Draggable Thumb Handle */}
        <div
          style={{ top: `calc(${progress}% - 18px)` }}
          className={`absolute left-1/2 -translate-x-1/2 w-7 h-9 rounded-xl flex items-center justify-center shadow-md border transition-transform ${
            isDragging
              ? "scale-110 bg-blue-700 text-white border-blue-300 ring-4 ring-blue-500/25"
              : "bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
          }`}
        >
          <GripVertical className="w-4 h-4" />
          {isDragging && (
            <div
              className={`absolute ${
                side === "left" ? "left-full ml-2.5" : "right-full mr-2.5"
              } px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold whitespace-nowrap shadow-lg`}
            >
              {Math.round(progress)}%
            </div>
          )}
        </div>
      </div>

      {/* Bottom Quick-Jump Button */}
      <button
        type="button"
        onClick={() => scrollToRatio(1)}
        className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-slate-600 hover:text-blue-600 dark:text-slate-300 transition-colors"
        title="Jump to bottom"
        aria-label="Scroll to bottom"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}
