"use client";
import { txt } from "@/components/utils/txt";

/** Picks a number by dragging, and shows it at the right (`unit` after it, e.g. "%"). Applies at once, like Switch.
 *  `label` is read out by screen readers; arrow keys move it by `step`. */
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 min-w-0 flex-1 cursor-pointer accent-accent"
      />
      <span className="w-[3.2em] shrink-0 text-right text-[0.85rem] font-bold text-ink tabular-nums">
        {txt(`${value}${unit}`)}
      </span>
    </div>
  );
}
