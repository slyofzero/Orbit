"use client";
import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "./cx";
import { isSpecial } from "./Special";
import { txt } from "./txt";

export type Tab<V extends string> = { value: V; label: ReactNode; count?: number };

/** Pill-shaped tabs. Arrow keys move between them. Render the matching panel yourself below.
 *  `special`: true = every tab, or a list of tab values = just those. */
export function Tabs<V extends string>({
  label,
  tabs,
  value,
  onChange,
  special,
}: {
  label: string;
  tabs: Tab<V>[];
  value: V;
  onChange: (v: V) => void;
  special?: boolean | readonly V[];
}) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.value === value);
    onChange(tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].value);
  };
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t) => {
        const on = t.value === value;
        const sp = isSpecial(special, t.value);
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cx(
              "inline-flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 py-[7px] font-body text-[0.9rem] font-bold",
              on
                ? sp
                  ? "special-fill animate-flow"
                  : "border-accent bg-accent text-on-accent"
                : sp
                  ? "special-border animate-flow-border text-ink"
                  : "border-line bg-sheet text-ink hover:border-ink",
            )}
          >
            {txt(t.label)}
            {t.count !== undefined && (
              <span
                className={cx(
                  "rounded-full px-[7px] py-px text-xs",
                  on ? (sp ? "bg-white/22 text-white" : "bg-on-accent/20 text-on-accent") : "bg-sheet-2 text-gray",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
