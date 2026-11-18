"use client";
// Custom dropdown list (a styled replacement for <select>).
// Keyboard: ↑/↓ move, Home/End jump, Enter or Space picks, Esc closes, typing a letter jumps to it.
// `searchable` adds a filter box at the top (for long lists such as topics).

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useDismiss } from "@/components/ui/useDismiss";
import { IconCheck, IconChevronDown, IconSearch } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { FieldLabel, FieldMessage } from "@/components/ui/Field";
import { POPUP, triggerClass, triggerIconClass } from "@/components/ui/styles";
import { txt } from "@/components/ui/txt";

export type DropdownOption<V extends string> = {
  value: V;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export function Dropdown<V extends string>({
  label,
  help,
  options,
  value,
  onChange,
  placeholder = "Choose…",
  searchable = false,
  hint,
  error,
  size = "md",
}: {
  label?: ReactNode;
  help?: ReactNode; // shows a "?" tip beside the label
  options: DropdownOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
  placeholder?: string;
  searchable?: boolean;
  size?: "sm" | "md"; // sm = compact, for toolbars (e.g. the code editor's language picker)
  hint?: ReactNode;
  error?: ReactNode;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => (o.label + " " + (o.description ?? "")).toLowerCase().includes(q)) : options;
  }, [options, query]);
  const selected = options.find((o) => o.value === value) ?? null;

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    trigger.current?.focus();
  }, []);
  const refs = useMemo(() => [wrap], []);
  useDismiss(open, close, refs);

  const openList = () => {
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : options.findIndex((o) => !o.disabled));
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    (searchable ? search.current : list.current)?.focus();
  }, [open, searchable]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);
  useEffect(() => {
    setActive(shown.findIndex((o) => !o.disabled));
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (o: DropdownOption<V> | undefined) => {
    if (!o || o.disabled) return;
    onChange(o.value);
    close();
  };
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < shown.length; i += dir) if (!shown[i].disabled) return i;
    return from;
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => step(a, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => step(a, -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(step(-1, 1));
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(step(shown.length, -1));
    } else if (e.key === "Enter" || (e.key === " " && !searchable)) {
      e.preventDefault();
      choose(shown[active]);
    } else if (e.key === "Tab") close();
    else if (!searchable && e.key.length === 1 && /\S/.test(e.key)) {
      const k = e.key.toLowerCase();
      const n = shown.length;
      for (let j = 1; j <= n; j++) {
        const i = (active + j) % n;
        if (!shown[i].disabled && shown[i].label.toLowerCase().startsWith(k)) {
          setActive(i);
          break;
        }
      }
    }
  };
  const onTriggerKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openList();
    }
  };

  return (
    <div className="grid gap-1.5">
      <FieldLabel htmlFor={id} label={label} help={help} />
      <div className="relative" ref={wrap}>
        <button
          ref={trigger}
          id={id}
          type="button"
          className={triggerClass({ open, empty: !selected, size })}
          aria-invalid={error ? true : undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-describedby={hint || error ? `${id}-msg` : undefined}
          onClick={() => (open ? close() : openList())}
          onKeyDown={onTriggerKey}
        >
          <span className="inline-flex min-w-0 items-center gap-2 truncate [&_svg]:size-4 [&_svg]:shrink-0">
            {selected ? (
              <>
                {selected.icon}
                {txt(selected.label)}
              </>
            ) : (
              txt(placeholder)
            )}
          </span>
          <IconChevronDown className={triggerIconClass(open)} />
        </button>

        {open && (
          <div className={cx(POPUP, "w-full min-w-[220px] overflow-hidden")}>
            {searchable && (
              <div className="flex items-center gap-2 border-b border-line-2 px-3 py-2.5 text-gray [&>svg]:size-4 [&>svg]:shrink-0">
                <IconSearch />
                <input
                  ref={search}
                  type="text"
                  className="min-w-0 flex-1 bg-transparent font-body text-[0.95rem] text-ink outline-none"
                  value={query}
                  placeholder="Type to filter…"
                  aria-label="Filter options"
                  aria-controls={listId}
                  aria-activedescendant={shown[active] ? `${id}-o${active}` : undefined}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKey}
                />
              </div>
            )}
            <ul
              ref={list}
              id={listId}
              role="listbox"
              tabIndex={searchable ? -1 : 0}
              className="m-0 max-h-[264px] list-none overflow-y-auto p-1.5 focus:outline-none"
              aria-activedescendant={!searchable && shown[active] ? `${id}-o${active}` : undefined}
              onKeyDown={searchable ? undefined : onKey}
            >
              {shown.length === 0 && <li className="p-2.5 text-[0.9rem] text-gray">Nothing matches “{query}”.</li>}
              {shown.map((o, i) => (
                <li
                  key={o.value}
                  id={`${id}-o${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={o.value === value}
                  aria-disabled={o.disabled || undefined}
                  className={cx(
                    "flex items-center gap-2.5 rounded-sm px-2.5 py-2 aria-selected:font-bold aria-selected:text-accent",
                    i === active && "bg-sheet-2",
                    o.disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
                  )}
                  onPointerMove={() => !o.disabled && setActive(i)}
                  onClick={() => choose(o)}
                >
                  {o.icon && <span className="inline-grid shrink-0 place-items-center [&_svg]:size-4">{o.icon}</span>}
                  <span className="grid min-w-0 flex-1">
                    <span>{txt(o.label)}</span>
                    {o.description && <span className="text-[0.8rem] font-normal text-gray">{txt(o.description)}</span>}
                  </span>
                  {o.value === value && <IconCheck className="size-4 shrink-0" />}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <FieldMessage id={id} hint={hint} error={error} />
    </div>
  );
}
