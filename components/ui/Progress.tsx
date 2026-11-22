import type { ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { txt } from "@/components/utils/txt";

export type ProgressTone = "accent" | "green" | "red" | "amber" | "warm" | "gold" | "special";

const FILL: Record<ProgressTone, string> = {
  accent: "bg-accent",
  green: "bg-green",
  red: "bg-red",
  amber: "bg-amber",
  warm: "special-fill warm", // v1's "main event" gradient
  gold: "bg-linear-to-r from-hi to-warm-d", // v1's bonus stretch
  special: "special-fill animate-flow",
};
// the empty part of the bar
const TRACK: Partial<Record<ProgressTone, string>> = { gold: "bg-hi/20" };

export type ProgressSegment = { value: number; max: number; tone?: ProgressTone };

/** A bar towards a total. `segments` splits it into stretches side by side (each as wide as its `max`),
 *  e.g. a day's own questions then a golden stretch of carried-over bonus ones; `value` / `max` are
 *  then ignored. `showLabel={false}` keeps the label for screen readers only. */
export function ProgressBar({
  value = 0,
  max = 100,
  label,
  showLabel = true,
  showValue = true,
  tone = "accent",
  segments,
}: {
  value?: number;
  max?: number;
  label: string;
  showLabel?: boolean;
  showValue?: boolean;
  tone?: ProgressTone;
  segments?: ProgressSegment[];
}) {
  const parts = (segments ?? [{ value, max, tone }]).filter((s) => s.max > 0 || !segments);
  const total = parts.reduce((n, s) => n + s.max, 0);
  const done = parts.reduce((n, s) => n + Math.min(s.value, s.max), 0);
  const pct = (s: ProgressSegment) => (s.max > 0 ? Math.max(0, Math.min(100, (s.value / s.max) * 100)) : 0);
  return (
    <div className="grid gap-1.5">
      {showLabel && (
        <div className="flex justify-between gap-2.5 text-[0.88rem]">
          <span>{txt(label)}</span>
          {showValue && (
            <span className="text-gray tabular-nums">
              {done} / {total}
            </span>
          )}
        </div>
      )}
      <div
        className="flex h-2 gap-[3px]"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        {parts.map((s, i) => (
          <span
            key={i}
            className={cx("block h-full overflow-hidden rounded-full", TRACK[s.tone ?? tone] ?? "bg-line-2")}
            style={{ flex: segments ? s.max : 1 }}
          >
            <span
              className={cx(
                "block h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                FILL[s.tone ?? tone],
              )}
              style={{ width: `${pct(s)}%` }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

/** One big number with a label. `trend` colours the hint green (up) or red (down). */
export function Stat({
  value,
  label,
  hint,
  trend,
}: {
  value: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  trend?: "up" | "down";
}) {
  return (
    <div className="grid gap-1">
      <span className="font-display text-[2.1rem] leading-none font-bold tracking-[-0.02em] tabular-nums">
        {txt(value)}
      </span>
      <span className="text-sm text-gray">{txt(label)}</span>
      {hint && (
        <span className={cx("text-[0.8rem] font-bold", trend === "up" && "text-green", trend === "down" && "text-red")}>
          {txt(hint)}
        </span>
      )}
    </div>
  );
}
