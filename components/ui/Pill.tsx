import type { ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { txt } from "@/components/utils/txt";

export type PillTone = "neutral" | "accent" | "green" | "red" | "amber" | "blue" | "ink" | "special";

const TONE: Record<PillTone, string> = {
  neutral: "bg-sheet-2 text-ink-2",
  accent: "bg-accent-soft text-accent",
  green: "bg-green-soft text-green",
  red: "bg-red-soft text-red",
  amber: "bg-amber-soft text-amber",
  blue: "bg-blue-soft text-blue",
  ink: "bg-ink text-sheet",
  special: "special-fill animate-flow",
};

/** Small rounded label: status, difficulty, counts, tags. `special` = animated gradient. */
export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-[5px] rounded-full px-2.5 py-[3px] text-[0.78rem] leading-[1.3] font-bold whitespace-nowrap",
        TONE[tone],
      )}
    >
      {txt(children)}
    </span>
  );
}

/** A keyboard key, e.g. <Kbd>Esc</Kbd>. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-[5px] border border-b-2 border-line bg-sheet px-1.5 py-0.5 font-mono text-[0.78rem] font-bold">
      {children}
    </kbd>
  );
}
