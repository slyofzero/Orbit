// v1's thin progress strip (the planner's section headers): one segment per day, as wide as its
// `weight`. Green = done, red = missed, accent fill = part done (`part` 0–1), grey = nothing yet.
// It is one picture for screen readers: say what it shows in `label`.

import { cx } from "@/components/utils/cx";

export type DayStripState = "won" | "missed" | "partial" | "none";
export type DayStripSegment = { key: string; weight?: number; state: DayStripState; part?: number };

export function DayStrip({
  segments,
  label,
  className,
}: {
  segments: DayStripSegment[];
  /** plain text read aloud, e.g. "12 of 26 days done, 3 missed" */
  label: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cx("flex h-2 w-[140px] flex-none gap-px overflow-hidden rounded-lg bg-line-2", className)}
    >
      {segments.map((s) => (
        <i
          key={s.key}
          className={cx(
            "min-w-px basis-0",
            s.state === "won" ? "bg-green" : s.state === "missed" ? "bg-red" : s.state === "none" && "bg-line-2",
          )}
          style={{
            flexGrow: Math.max(s.weight ?? 1, 1),
            ...(s.state === "partial"
              ? {
                  background: `linear-gradient(90deg, var(--accent) ${(s.part ?? 0) * 100}%, var(--line-2) ${(s.part ?? 0) * 100}%)`,
                }
              : {}),
          }}
        />
      ))}
    </span>
  );
}
