"use client";
// Light / System / Dark. Switching plays v1's ripple: the new theme spreads out in a circle from
// where you clicked (or from the focused button when using the keyboard).

import { useEffect, useRef, useState } from "react";
import { applyThemeWithRipple, readTheme, type ThemeChoice } from "@/lib/theme";
import { Segmented } from "./Segmented";
import { IconMonitor, IconMoon, IconSun } from "./icons";

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const pointer = useRef<{ x: number; y: number; at: number } | null>(null);
  useEffect(() => setChoice(readTheme()), []);

  const origin = () => {
    const p = pointer.current;
    if (p && Date.now() - p.at < 1000) return p; // a click just happened: start there
    const r = (document.activeElement as HTMLElement | null)?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: 0 };
  };
  const pick = (c: ThemeChoice) => {
    if (c === choice) return;
    setChoice(c);
    const { x, y } = origin();
    applyThemeWithRipple(c, x, y);
  };

  return (
    <span
      className="inline-flex"
      onPointerDownCapture={(e) => {
        pointer.current = { x: e.clientX, y: e.clientY, at: Date.now() };
      }}
    >
      <Segmented
        label="Theme"
        value={choice}
        onChange={pick}
        segments={[
          { value: "light", label: "Light", icon: <IconSun /> },
          { value: "system", label: "System", icon: <IconMonitor /> },
          { value: "dark", label: "Dark", icon: <IconMoon /> },
        ]}
      />
    </span>
  );
}
