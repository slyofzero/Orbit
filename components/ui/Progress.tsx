import type { ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { txt } from "@/components/utils/txt";

export type ProgressTone = "accent" | "green" | "red" | "amber" | "special";

const FILL: Record<ProgressTone, string> = {
  accent: "bg-accent",
  green: "bg-green",
  red: "bg-red",
  amber: "bg-amber",
  special: "special-fill animate-flow",
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  tone = "accent",
}: {
  value: number;
  max?: number;
  label: string;
  showValue?: boolean;
  tone?: ProgressTone;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between gap-2.5 text-[0.88rem]">
        <span>{txt(label)}</span>
        {showValue && (
          <span className="text-gray tabular-nums">
            {value} / {max}
          </span>
        )}
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-line-2"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div
          className={cx("h-full rounded-full transition-[width] duration-300", FILL[tone])}
          style={{ width: `${pct}%` }}
        />
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
