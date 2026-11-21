"use client";
// A "Filter" button with a pop-up of choices grouped under headings (v1's TagFilter): a search box, the
// chosen choices as removable chips with "Clear all", then every group's remaining choices as chips, 20 at
// a time ("… N more"). It only holds the list of chosen values; what a value means is up to the page.

import { useCallback, useMemo, useRef, useState } from "react";
import { IconFilter, IconX } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { cx } from "@/components/utils/cx";
import { POPUP } from "@/components/utils/styles";
import { txt } from "@/components/utils/txt";
import { useDismiss } from "@/components/utils/useDismiss";

export type FilterChoice = { value: string; label: string; count?: number };
export type FilterGroup = { key: string; label: string; choices: FilterChoice[] };

const STEP = 20;

const CHIP =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 font-body text-[0.85rem] font-semibold transition-colors duration-150";

function Chip({
  choice,
  on = false,
  onClick,
}: {
  choice: { label: string; count?: number };
  on?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={on ? "Remove" : undefined}
      className={cx(
        CHIP,
        on ? "border-accent bg-accent-soft text-accent" : "border-line bg-sheet text-ink hover:border-ink",
      )}
    >
      {txt(choice.label)}
      {choice.count !== undefined && <span className="text-xs font-normal text-gray">{choice.count}</span>}
      {on && <IconX className="size-3" />}
    </button>
  );
}

/** `groups`: the choices, under headings (a value must be unique across all groups). `picked` / `onChange`:
 *  the chosen values. Shows nothing at all when there are no choices and nothing is chosen. Put it at the end
 *  of a toolbar row; the pop-up opens under it and closes on Esc or a click outside. */
export function FilterMenu({
  groups,
  picked,
  onChange,
  label = "Filter",
}: {
  groups: FilterGroup[];
  picked: string[];
  onChange: (picked: string[]) => void;
  label?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [wrap], []);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [extra, setExtra] = useState<Record<string, number>>({}); // groups' "… more" clicks
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setExtra({});
  }, []);
  useDismiss(open, close, refs);

  const shown = groups.filter((g) => g.choices.length > 0);
  if (shown.length === 0 && picked.length === 0) return null;

  const byValue = new Map(groups.flatMap((g) => g.choices).map((c) => [c.value, c]));
  const total = shown.reduce((n, g) => n + g.choices.length, 0);
  const q = query.trim().toLowerCase();
  const toggle = (v: string) => onChange(picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v]);
  const rows = shown
    .map((g) => ({
      g,
      left: g.choices.filter((c) => !picked.includes(c.value) && (!q || c.label.toLowerCase().includes(q))),
    }))
    .filter((r) => r.left.length > 0);

  return (
    <div className="relative" ref={wrap}>
      <Button
        variant="soft"
        icon={<IconFilter />}
        className={cx(picked.length > 0 && "border-accent")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="inline-flex items-center gap-2">
          {txt(label)}
          {picked.length > 0 && (
            <span className="rounded-full bg-accent px-[7px] py-px text-xs text-on-accent">{picked.length}</span>
          )}
        </span>
      </Button>
      {open && (
        <div role="dialog" aria-label={label} className={cx(POPUP, "grid w-[min(560px,calc(100vw-36px))] gap-3 p-3.5")}>
          <input
            autoFocus
            type="search"
            value={query}
            placeholder={`Find a ${shown.map((g) => g.label.toLowerCase()).join(", ")} (${total} choices)`}
            aria-label="Find a filter choice"
            onChange={(e) => {
              setQuery(e.target.value);
              setExtra({});
            }}
            className="w-full rounded-full border-[1.5px] border-line bg-sheet px-4 py-2 font-body text-[0.92rem] text-ink transition-[border-color,box-shadow] duration-150 hover:border-gray focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {picked.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {picked.map((v) => (
                <Chip
                  key={v}
                  on
                  choice={byValue.get(v) ?? { label: v.slice(v.indexOf(":") + 1) }}
                  onClick={() => toggle(v)}
                />
              ))}
              <button
                type="button"
                onClick={() => onChange([])}
                className="cursor-pointer rounded-full px-2.5 py-1 font-body text-[0.85rem] font-bold text-gray hover:text-ink"
              >
                Clear all
              </button>
            </div>
          )}
          <div className="grid max-h-[min(420px,60vh)] gap-3.5 overflow-y-auto">
            {rows.map(({ g, left }) => {
              const n = STEP + (extra[g.key] ?? 0);
              return (
                <section key={g.key} className="grid gap-1.5">
                  <Text variant="caption" as="span">
                    {`${g.label} · ${left.length}`}
                  </Text>
                  <div className="flex flex-wrap gap-1.5">
                    {left.slice(0, n).map((c) => (
                      <Chip key={c.value} choice={c} onClick={() => toggle(c.value)} />
                    ))}
                    {left.length > n && (
                      <button
                        type="button"
                        className={cx(
                          CHIP,
                          "border-dashed border-line bg-sheet text-gray hover:border-ink hover:text-ink",
                        )}
                        aria-label={`Show ${Math.min(STEP, left.length - n)} more ${g.label} choices`}
                        onClick={() => setExtra((x) => ({ ...x, [g.key]: (x[g.key] ?? 0) + STEP }))}
                      >
                        {`… ${left.length - n} more`}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
            {q && rows.length === 0 && <Text variant="hint">{`Nothing matches “${query}”.`}</Text>}
          </div>
        </div>
      )}
    </div>
  );
}
