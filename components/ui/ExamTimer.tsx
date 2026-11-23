"use client";
// A mock's countdown ("Time left 01:59:07"). It runs from the wall clock (`endsAt`), so a refresh or a hidden tab
// never pauses it. Amber in the last 10 minutes, red (and pulsing) in the last 2; `onTimeUp` fires once at zero.
// Rules: lib/exam.ts (clockText, clockTone).

import { useEffect, useRef, useState } from "react";
import { clockText, clockTone } from "@/lib/exam";
import { cx, txt } from "@/components/utils";

export function ExamTimer({
  endsAt,
  onTimeUp,
  label = "Time left",
  className,
}: {
  endsAt: number; // Unix ms when time is up
  onTimeUp?: () => void;
  label?: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  const upRef = useRef(onTimeUp);
  upRef.current = onTimeUp;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const left = Math.max(0, endsAt - now);
  useEffect(() => {
    if (left > 0 || fired.current) return;
    fired.current = true;
    upRef.current?.();
  }, [left]);

  const tone = clockTone(left);
  return (
    <span
      role="timer"
      aria-live="off"
      className={cx(
        "inline-flex items-center gap-2 rounded-full border-[1.5px] px-3.5 py-1.5 text-[0.9rem] font-bold",
        tone === "normal" && "border-line bg-sheet/70 glass-blur text-ink",
        tone === "low" && "border-amber bg-amber-soft text-amber",
        tone === "critical" && "animate-timer-pulse border-red bg-red-soft text-red",
        className,
      )}
    >
      <span className="font-semibold">{txt(label)}</span>
      <span className="font-mono tabular-nums">{clockText(left)}</span>
    </span>
  );
}
