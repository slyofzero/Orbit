"use client";
// v1's small bar chart ("Last 7 days"): rounded accent bars growing up one after another, a short label
// under each. Empty bars stay as a stub in the line colour; `highlight` paints one highlighter yellow (today).
// A bar with a `tip` shows it in a Tooltip bubble on hover (markdown + maths).

import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cx } from "@/components/utils/cx";
import { txt } from "@/components/utils/txt";

export type Bar = {
  key: string;
  label: ReactNode;
  value: number;
  /** plain text for screen readers (default: the key) */
  title?: string;
  /** shown in a bubble while the pointer is over the bar */
  tip?: ReactNode;
  highlight?: boolean;
};

const COLUMN = "flex h-full flex-1 items-end justify-center";

export function BarChart({
  bars,
  label,
  height = 110,
  max,
}: {
  bars: Bar[];
  /** what the chart shows, for screen readers */
  label: string;
  /** px, the tallest bar */
  height?: number;
  /** the value that fills a bar; default: the largest value (at least 4, so a quiet week doesn't look full) */
  max?: number;
}) {
  const top = max ?? Math.max(4, ...bars.map((b) => b.value));
  return (
    <div role="img" aria-label={`${label}: ${bars.map((b) => `${b.title ?? b.key} ${b.value}`).join(", ")}`}>
      <div className="flex items-end gap-2.5" style={{ height }}>
        {bars.map((b, i) => {
          const bar = (
            <span
              className={cx(
                "block w-full max-w-[38px] origin-bottom animate-bar-grow rounded-[10px_10px_4px_4px] transition-opacity duration-150",
                b.highlight ? "bg-hi" : b.value ? "bg-accent" : "bg-line",
                b.tip != null && "hover:opacity-80",
              )}
              style={{
                height: `${b.value ? Math.max(10, (b.value / top) * 100) : 6}%`,
                animationDelay: `${i * 60}ms`,
              }}
            />
          );
          return b.tip != null ? (
            <Tooltip key={b.key} content={b.tip} className={COLUMN}>
              {bar}
            </Tooltip>
          ) : (
            <div key={b.key} className={COLUMN}>
              {bar}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2.5" aria-hidden>
        {bars.map((b) => (
          <span
            key={b.key}
            className={cx("flex-1 text-center text-[0.74rem] font-bold", b.highlight ? "text-ink" : "text-gray")}
          >
            {txt(b.label)}
          </span>
        ))}
      </div>
    </div>
  );
}
