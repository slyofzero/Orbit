"use client";
import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "./cx";
import { isSpecial } from "./Special";
import { txt } from "./txt";

export type Tab<V extends string> = { value: V; label: ReactNode; count?: number };

/** Pill-shaped tabs. Arrow keys move between them. Render the matching panel yourself below.
 *  `special`: true = every tab, or a list of tab values = just those. */
export function Tabs<V extends string>({ label, tabs, value, onChange, special }: {
  label: string; tabs: Tab<V>[]; value: V; onChange: (v: V) => void; special?: boolean | readonly V[];
}) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.value === value);
    onChange(tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].value);
  };
  return (
    <div className="ui-tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" className={cx("ui-tab", isSpecial(special, t.value) && "is-special")}
          aria-selected={t.value === value} tabIndex={t.value === value ? 0 : -1} onClick={() => onChange(t.value)}>
          {txt(t.label)}
          {t.count !== undefined && <span className="ui-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
