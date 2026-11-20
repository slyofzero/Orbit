import type { ReactNode } from "react";
import { cx, txt } from "@/components/utils";

export type RingTone = "hi" | "accent" | "green";

const STROKE: Record<RingTone, string> = { hi: "stroke-hi", accent: "stroke-accent", green: "stroke-green" };
const R = 22;
const C = 2 * Math.PI * R;

/** A round progress meter (v1's "tasks today" ring). The track uses the current text colour, so it
 *  works on light cards and on the dark hero alike. Size it with `className` (default 52px);
 *  `children` sit in the middle. */
export function ProgressRing({
  value,
  max,
  label,
  tone = "accent",
  className = "size-[52px]",
  children,
}: {
  value: number;
  max: number;
  label: string; // read by screen readers, e.g. "Tasks done today"
  tone?: RingTone;
  className?: string;
  children?: ReactNode;
}) {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <span
      className={cx("relative inline-grid flex-none place-items-center", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <svg viewBox="0 0 52 52" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="26" cy="26" r={R} fill="none" strokeWidth="6" className="stroke-current opacity-20" />
        <circle
          cx="26"
          cy="26"
          r={R}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          className={cx(
            STROKE[tone],
            "transition-[stroke-dashoffset] duration-[900ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            frac === 0 && "opacity-0",
          )}
        />
      </svg>
      {children !== undefined && (
        <span className="relative font-display text-xs font-bold tabular-nums">{txt(children)}</span>
      )}
    </span>
  );
}
