"use client";

import { useEffect, useCallback } from "react";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { readTheme, applyTheme, applyThemeWithRipple, type ThemeChoice } from "@/lib/theme";

export type { ThemeChoice } from "@/lib/theme";

/** Raw user choice: "light" | "dark" | "system" */
export const themeChoiceAtom = atom<ThemeChoice>("system");

/** Whether the OS prefers dark mode */
export const systemDarkAtom = atom<boolean>(false);

/** Resolved boolean: whether the active view is dark mode */
export const isDarkAtom = atom<boolean>((get) => {
  const choice = get(themeChoiceAtom);
  return choice === "dark" || (choice === "system" && get(systemDarkAtom));
});

/**
 * Global hook to read and control Orbit's theme.
 * Returns the current choice, resolved isDark, and functions to set or toggle it.
 */
export function useTheme() {
  const [theme, setChoice] = useAtom(themeChoiceAtom);
  const isDark = useAtomValue(isDarkAtom);
  const setSystemDark = useSetAtom(systemDarkAtom);

  useEffect(() => {
    setChoice(readTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [setChoice, setSystemDark]);

  const setTheme = useCallback(
    (choice: ThemeChoice, origin?: { x: number; y: number }) => {
      setChoice(choice);
      if (origin) {
        applyThemeWithRipple(choice, origin.x, origin.y);
      } else {
        applyTheme(choice);
      }
    },
    [setChoice],
  );

  const toggleTheme = useCallback(
    (origin?: { x: number; y: number }) => {
      setTheme(isDark ? "light" : "dark", origin);
    },
    [isDark, setTheme],
  );

  return { theme, isDark, setTheme, toggleTheme };
}
