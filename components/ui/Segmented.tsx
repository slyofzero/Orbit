"use client";
import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "./cx";
import { isSpecial } from "./Special";
import { txt } from "./txt";

export type Segment<V extends string> = { value: V; label: ReactNode; icon?: ReactNode };

/** A small set of mutually exclusive choices shown side by side (e.g. Light / System / Dark). Arrow keys move.
 *  `special`: true = every segment, or a list of segment values = just those. */
export function Segmented<V extends string>({ label, segments, value, onChange, special }: {
  label: string; segments: Segment<V>[]; value: V; onChange: (v: V) => void; special?: boolean | readonly V[];
}) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = segments.findIndex((s) => s.value === value);
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + segments.length) % segments.length;
    onChange(segments[n].value);
  };
  return (
    <div className={cx("ui-seg", special === true && "is-special")} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {segments.map((s) => (
        <button key={s.value} type="button" role="radio" aria-checked={s.value === value}
          className={cx(isSpecial(special, s.value) && "is-special")}
          tabIndex={s.value === value ? 0 : -1} onClick={() => onChange(s.value)}>
          {s.icon}{txt(s.label)}
        </button>
      ))}
    </div>
  );
}
