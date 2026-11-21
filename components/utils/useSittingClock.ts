"use client";
// Times each question of a sitting (docs/STATS.md §2): the question on screen is the one whose clock runs, and
// only while the tab is visible, the window has focus and the learner is active. Every question keeps its own
// clock for the whole sitting, so coming back to it adds to the time. The rules are in lib/activeClock.ts.

import { useCallback, useEffect, useRef } from "react";
import { ActiveClock } from "@/lib/activeClock";

const ACTIVITY = ["pointermove", "pointerdown", "keydown", "scroll", "touchstart"] as const;

/** `currentId` = the question on screen (null = none, nothing runs). Returns `timeOf(id)`: active ms so far. */
export function useSittingClock(currentId: string | null): (id: string) => number {
  const clocks = useRef(new Map<string, ActiveClock>());
  const clockOf = useCallback((id: string) => {
    let c = clocks.current.get(id);
    if (!c) clocks.current.set(id, (c = new ActiveClock()));
    return c;
  }, []);

  useEffect(() => {
    if (!currentId) return;
    const clock = clockOf(currentId);
    const here = () => document.visibilityState === "visible" && document.hasFocus();
    const resume = () => {
      if (here()) clock.start(Date.now());
    };
    const pause = () => clock.stop(Date.now());
    const onVisibility = () => (document.visibilityState === "visible" ? resume() : pause());
    const poke = () => clock.activity(Date.now());

    resume();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", resume);
    window.addEventListener("blur", pause);
    for (const e of ACTIVITY) window.addEventListener(e, poke, { passive: true, capture: true });
    return () => {
      pause();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", resume);
      window.removeEventListener("blur", pause);
      for (const e of ACTIVITY) window.removeEventListener(e, poke, { capture: true });
    };
  }, [currentId, clockOf]);

  return useCallback((id: string) => clockOf(id).elapsed(Date.now()), [clockOf]);
}
