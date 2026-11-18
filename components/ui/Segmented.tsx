"use client";
import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { isSpecial } from "@/components/ui/Special";
import { txt } from "@/components/ui/txt";

export type Segment<V extends string> = { value: V; label: ReactNode; icon?: ReactNode };

/** A small set of mutually exclusive choices shown side by side (e.g. Light / System / Dark). Arrow keys move.
 *  `special`: true = every segment, or a list of segment values = just those. `size="sm"` for toolbars. */
export function Segmented<V extends string>({
  label,
  segments,
  value,
  onChange,
  special,
  size = "md",
}: {
  label: string;
  segments: Segment<V>[];
  value: V;
  onChange: (v: V) => void;
  special?: boolean | readonly V[];
  size?: "sm" | "md";
}) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = segments.findIndex((s) => s.value === value);
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + segments.length) % segments.length;
    onChange(segments[n].value);
  };
  return (
    <div
      className={cx(
        "inline-flex gap-0.5 rounded-full border-[1.5px] border-line bg-sheet",
        size === "sm" ? "p-0.5" : "p-[3px]",
      )}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
    >
      {segments.map((s) => {
        const on = s.value === value;
        const sp = isSpecial(special, s.value);
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(s.value)}
            className={cx(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full font-body font-bold [&_svg]:size-4",
              size === "sm" ? "px-2.5 py-1 text-[0.8rem]" : "px-3.5 py-1.5 text-[0.85rem]",
              on
                ? sp
                  ? "special-fill animate-flow [&_svg]:text-white"
                  : "bg-accent-soft text-accent"
                : sp
                  ? "special-text animate-flow [&_svg]:text-special-b"
                  : "text-gray hover:text-ink",
            )}
          >
            {s.icon}
            {txt(s.label)}
          </button>
        );
      })}
    </div>
  );
}
