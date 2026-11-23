"use client";

import { useCallback } from "react";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";

export const launchLandedAtom = atom(false);
export const launchingPlanAtom = atom<string | null>(null);

/**
 * Global hook to read or control the post-import launch sequence and landed state.
 */
export function useLaunch() {
  const landed = useAtomValue(launchLandedAtom);
  const setLanded = useSetAtom(launchLandedAtom);
  const [launching, setLaunching] = useAtom(launchingPlanAtom);

  const start = useCallback(
    (planName: string) => {
      setLaunching(planName);
      setLanded(true);
    },
    [setLanded, setLaunching],
  );

  const finish = useCallback(() => {
    setLaunching(null);
  }, [setLaunching]);

  return { landed, launching, start, finish };
}
