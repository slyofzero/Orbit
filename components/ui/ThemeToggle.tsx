"use client";
// Light / System / Dark. Switching plays v1's ripple: the new theme spreads out in a circle from
// where you clicked (or from the focused button when using the keyboard).

import { useEffect, useRef, useState } from "react";
import { applyThemeWithRipple, readTheme, type ThemeChoice } from "@/lib/theme";
import { Segmented } from "@/components/ui/Segmented";
import { IconMonitor, IconMoon, IconSparkle, IconSun } from "@/components/icons";

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const NAME: Record<ThemeChoice, string> = { system: "System default", light: "Light", dark: "Dark" };
const ICON: Record<ThemeChoice, React.ReactNode> = { system: <IconMonitor />, light: <IconSun />, dark: <IconMoon /> };
const DOCK_BTN =
  "grid h-10 w-9 cursor-pointer place-items-center text-ink transition-colors duration-200 hover:bg-hi hover:text-black [&_svg]:size-5 [&_svg]:transition-transform [&_svg]:duration-300 active:[&_svg]:scale-80";

/** `compact` = v1's pill for narrow places (the side rail): a cosmic-event button on the left
 *  (`onCosmic`; does nothing until cosmic events exist) and a theme button on the right that
 *  shows the current choice's icon and moves System → Light → Dark on each click. */
export function ThemeToggle({ compact = false, onCosmic }: { compact?: boolean; onCosmic?: () => void }) {
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

  if (compact)
    return (
      <span
        className="inline-flex overflow-hidden rounded-full border-[1.5px] border-line bg-sheet"
        onPointerDownCapture={(e) => {
          pointer.current = { x: e.clientX, y: e.clientY, at: Date.now() };
        }}
      >
        <button
          type="button"
          className={DOCK_BTN}
          aria-label="Trigger a cosmic event"
          title="Trigger a cosmic event"
          onClick={onCosmic}
        >
          <IconSparkle />
        </button>
        <button
          type="button"
          className={`${DOCK_BTN} border-l-[1.5px] border-line`}
          aria-label={`Theme: ${NAME[choice]} (click for ${NAME[NEXT[choice]]})`}
          title={`Theme: ${NAME[choice]} (click for ${NAME[NEXT[choice]]})`}
          onClick={() => pick(NEXT[choice])}
        >
          {ICON[choice]}
        </button>
      </span>
    );

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
