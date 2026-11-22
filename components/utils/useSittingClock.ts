"use client";
// Times each question of a sitting (docs/STATS.md §2): the question on screen is the one whose clock runs, and
// only while the tab is visible, the window has focus and the learner is active. Every question keeps its own
// clock for the whole sitting, so coming back to it adds to the time. Practice stops a question's clock the moment
// it is answered (`freeze`) and starts a fresh one on Try again (`restart`). The rules are in lib/activeClock.ts.

import { useCallback, useEffect, useRef } from "react";
import { ActiveClock } from "@/lib/activeClock";

const ACTIVITY = ["pointermove", "pointerdown", "keydown", "scroll", "touchstart"] as const;
const here = () => document.visibilityState === "visible" && document.hasFocus();

export interface SittingClock {
  /** active ms so far on that question */
  timeOf: (id: string) => number;
  /** stops the question's clock for good (it was answered); nothing more counts until `restart` */
  freeze: (id: string) => void;
  /** a new attempt (Try again): the time starts from 0 and runs while the question is on screen */
  restart: (id: string) => void;
}

/** `currentId` = the question on screen (null = none, nothing runs). */
export function useSittingClock(currentId: string | null): SittingClock {
  const clocks = useRef(new Map<string, ActiveClock>());
  const frozen = useRef(new Set<string>());
  const current = useRef(currentId);
  current.current = currentId;
  const clockOf = useCallback((id: string) => {
    let c = clocks.current.get(id);
    if (!c) clocks.current.set(id, (c = new ActiveClock()));
    return c;
  }, []);

  useEffect(() => {
    if (!currentId) return;
    // look the clock up each time: `restart` swaps in a new one
    const resume = () => {
      if (here() && !frozen.current.has(currentId)) clockOf(currentId).start(Date.now());
    };
    const pause = () => clockOf(currentId).stop(Date.now());
    const onVisibility = () => (document.visibilityState === "visible" ? resume() : pause());
    const poke = () => clockOf(currentId).activity(Date.now());

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

  const timeOf = useCallback((id: string) => clockOf(id).elapsed(Date.now()), [clockOf]);
  const freeze = useCallback(
    (id: string) => {
      clockOf(id).stop(Date.now());
      frozen.current.add(id);
    },
    [clockOf],
  );
  const restart = useCallback((id: string) => {
    frozen.current.delete(id);
    const c = new ActiveClock();
    clocks.current.set(id, c);
    if (current.current === id && here()) c.start(Date.now());
  }, []);
  return { timeOf, freeze, restart };
}
