"use client";
// Date picker for plain "YYYY-MM-DD" (IST) dates. Opens a month calendar under the field.
// Keyboard: arrows move a day/week, PageUp/PageDown a month, Home/End the week's start/end,
// Enter picks, Esc closes.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { addDays, addMonths, formatDate, monthGrid, MONTHS, parseIso, todayIST, weekday, WEEKDAYS_SHORT, type IsoDate } from "@/lib/dates";
import { useDismiss } from "./useDismiss";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "./icons";
import { cx } from "./cx";
import { Button, IconButton } from "./Button";
import { FieldLabel } from "./Field";
import { txt } from "./txt";

export function DatePicker({ label, help, value, onChange, min, max, placeholder = "Pick a date", hint, error, clearable = false }: {
  label?: ReactNode;
  help?: ReactNode;      // shows a "?" tip beside the label
  value: IsoDate | null;
  onChange: (d: IsoDate | null) => void;
  min?: IsoDate;
  max?: IsoDate;
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  clearable?: boolean;
}) {
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<IsoDate>(value ?? todayIST());
  const today = todayIST();

  const close = useCallback(() => { setOpen(false); trigger.current?.focus(); }, []);
  const refs = useMemo(() => [wrap], []);
  useDismiss(open, close, refs);

  const allowed = (d: IsoDate) => (!min || d >= min) && (!max || d <= max);
  const clamp = (d: IsoDate) => (min && d < min ? min : max && d > max ? max : d);

  // move keyboard focus to the cursor day whenever it changes while open
  useEffect(() => {
    if (open) grid.current?.querySelector<HTMLButtonElement>(`[data-date="${cursor}"]`)?.focus();
  }, [open, cursor]);

  const toggle = () => {
    if (!open) setCursor(clamp(value ?? today));
    setOpen((o) => !o);
  };
  const pick = (d: IsoDate) => { if (!allowed(d)) return; onChange(d); close(); };

  const onKey = (e: KeyboardEvent) => {
    const moves: Record<string, () => IsoDate> = {
      ArrowLeft: () => addDays(cursor, -1), ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7), ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, -1), PageDown: () => addMonths(cursor, 1),
      Home: () => addDays(cursor, -weekday(cursor)), End: () => addDays(cursor, 6 - weekday(cursor)),
    };
    if (moves[e.key]) { e.preventDefault(); setCursor(clamp(moves[e.key]())); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(cursor); }
  };

  const { y, m } = parseIso(cursor);
  const cells = monthGrid(y, m);

  return (
    <div className={cx("ui-field", error ? "has-error" : null)}>
      <FieldLabel htmlFor={id} label={label} help={help} />
      <div className="ui-pop-wrap" ref={wrap}>
        <button ref={trigger} id={id} type="button" className={cx("ui-trigger", !value && "is-empty")}
          aria-haspopup="dialog" aria-expanded={open} onClick={toggle}
          aria-describedby={hint || error ? `${id}-msg` : undefined}>
          <span>{value ? formatDate(value) : txt(placeholder)}</span>
          <IconCalendar className="ui-trigger-icon" />
        </button>

        {open && (
          <div className="ui-pop ui-dp" role="dialog" aria-label="Choose a date">
            <div className="ui-dp-head">
              <IconButton label="Previous month" size="sm" variant="ghost" onClick={() => setCursor(clamp(addMonths(cursor, -1)))}><IconChevronLeft /></IconButton>
              <span className="ui-dp-title" aria-live="polite">{MONTHS[m - 1]} {y}</span>
              <IconButton label="Next month" size="sm" variant="ghost" onClick={() => setCursor(clamp(addMonths(cursor, 1)))}><IconChevronRight /></IconButton>
            </div>
            <div className="ui-dp-grid" ref={grid} role="grid" onKeyDown={onKey}>
              {WEEKDAYS_SHORT.map((w) => <span key={w} className="ui-dp-dow" role="columnheader">{w.slice(0, 2)}</span>)}
              {cells.map(({ date, inMonth }) => (
                <button key={date} type="button" data-date={date} role="gridcell"
                  className={cx("ui-dp-day", !inMonth && "is-out", date === today && "is-today", date === value && "is-picked")}
                  tabIndex={date === cursor ? 0 : -1} disabled={!allowed(date)}
                  aria-selected={date === value} aria-label={formatDate(date) + (date === today ? " (today)" : "")}
                  onClick={() => pick(date)}>
                  {parseIso(date).d}
                </button>
              ))}
            </div>
            <div className="ui-dp-foot">
              <Button size="sm" variant="ghost" disabled={!allowed(today)} onClick={() => pick(today)}>Today</Button>
              {clearable && value && <Button size="sm" variant="ghost" onClick={() => { onChange(null); close(); }}>Clear</Button>}
            </div>
          </div>
        )}
      </div>
      {error ? <span className="ui-error" id={`${id}-msg`}>{txt(error)}</span>
        : hint ? <span className="ui-hint" id={`${id}-msg`}>{txt(hint)}</span> : null}
    </div>
  );
}
