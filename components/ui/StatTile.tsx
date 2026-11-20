// v1's "Where you stand" tile: a big number over a short label, on a soft tinted block.

import type { ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { txt } from "@/components/utils/txt";

export type StatTileTone = "accent" | "green" | "amber" | "neutral";

const TONE: Record<StatTileTone, { box: string; value: string }> = {
  accent: { box: "bg-accent-soft", value: "text-accent" },
  green: { box: "bg-green-soft", value: "text-green" },
  amber: { box: "bg-amber-soft", value: "text-amber" },
  neutral: { box: "bg-sheet-2", value: "text-ink" },
};

export function StatTile({
  value,
  label,
  tone = "neutral",
}: {
  value: ReactNode;
  label: ReactNode;
  tone?: StatTileTone;
}) {
  return (
    <div className={cx("grid min-w-0 content-start gap-1 rounded-[18px] px-3.5 py-3", TONE[tone].box)}>
      <span
        className={cx(
          "font-display text-[1.6rem] leading-none font-extrabold tracking-[-0.02em] tabular-nums",
          TONE[tone].value,
        )}
      >
        {txt(value)}
      </span>
      <span className="text-[0.8rem] text-ink-2">{txt(label)}</span>
    </div>
  );
}
