"use client";
import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { isSpecial } from "@/components/ui/Special";
import { txt } from "@/components/utils/txt";

export type Tab<V extends string> = { value: V; label: ReactNode; count?: number };

/** Pill-shaped tabs. Arrow keys move between them. Render the matching panel yourself below.
 *  `special`: true = every tab, or a list of tab values = just those.
 *  `shape`: `pills` (default) = separate pills · `bar` = one rounded bar with a filled pill on the open tab
 *  (v1's Topics / Programming / Mocks switcher; `special` is ignored in a bar). */
export function Tabs<V extends string>({
  label,
  tabs,
  value,
  onChange,
  special,
  shape = "pills",
}: {
  label: string;
  tabs: Tab<V>[];
  value: V;
  onChange: (v: V) => void;
  special?: boolean | readonly V[];
  shape?: "pills" | "bar";
}) {
  const bar = shape === "bar";
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.value === value);
    onChange(tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].value);
  };
  return (
    <div
      className={cx(
        bar ? "inline-flex gap-1 rounded-full border border-line bg-sheet-2 p-1" : "flex flex-wrap gap-1.5",
      )}
      role="tablist"
      aria-label={label}
      onKeyDown={onKey}
    >
      {tabs.map((t) => {
        const on = t.value === value;
        const sp = !bar && isSpecial(special, t.value);
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cx(
              "inline-flex cursor-pointer items-center gap-2 rounded-full font-body font-bold",
              bar ? "px-[18px] py-[7px] text-[0.92rem]" : "border-[1.5px] px-4 py-[7px] text-[0.9rem]",
              on
                ? sp
                  ? "special-fill animate-flow"
                  : bar
                    ? "bg-accent text-on-accent"
                    : "border-accent bg-accent text-on-accent"
                : sp
                  ? "special-border animate-flow-border text-ink"
                  : bar
                    ? "text-ink-2 hover:text-ink"
                    : "border-line bg-sheet text-ink hover:border-ink",
            )}
          >
            {txt(t.label)}
            {t.count !== undefined && (
              <span
                className={cx(
                  "rounded-full px-[7px] py-px text-xs",
                  on
                    ? sp
                      ? "bg-white/22 text-white"
                      : "bg-on-accent/20 text-on-accent"
                    : bar
                      ? "bg-sheet text-gray"
                      : "bg-sheet-2 text-gray",
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
