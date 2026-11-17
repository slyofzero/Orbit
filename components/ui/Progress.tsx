import type { ReactNode } from "react";
import { cx } from "./cx";
import { txt } from "./txt";

export type ProgressTone = "accent" | "green" | "red" | "amber" | "special";

export function ProgressBar({ value, max = 100, label, showValue = true, tone = "accent" }: {
  value: number; max?: number; label: string; showValue?: boolean; tone?: ProgressTone;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cx("ui-progress", `ui-progress-${tone}`)}>
      <div className="ui-progress-head">
        <span>{txt(label)}</span>
        {showValue && <span>{value} / {max}</span>}
      </div>
      <div className="ui-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <div className="ui-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** One big number with a label. `trend` colours the hint green (up) or red (down). */
export function Stat({ value, label, hint, trend }: { value: ReactNode; label: ReactNode; hint?: ReactNode; trend?: "up" | "down" }) {
  return (
    <div className="ui-stat">
      <span className="ui-stat-value">{txt(value)}</span>
      <span className="ui-stat-label">{txt(label)}</span>
      {hint && <span className={cx("ui-stat-hint", trend === "up" && "is-up", trend === "down" && "is-down")}>{txt(hint)}</span>}
    </div>
  );
}
