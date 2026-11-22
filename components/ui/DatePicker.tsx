"use client";
// Date fields for plain "YYYY-MM-DD" (IST) dates. Both open the same month calendar under the field.
// Calendar keyboard: arrows move a day/week, PageUp/PageDown a month, Home/End the week's start/end,
// Enter picks, Esc closes.
//   DatePicker: one date, picked from the calendar.
//   DateFilter: a day, week, month or weekday, typed ("23 Nov", "next week", "November", "saturday": a list of
//               suggestions under the box, lib/dates.ts suggestRanges) or picked from the calendar as a fallback.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  addDays,
  addMonths,
  dayRange,
  formatDate,
  formatRange,
  monthGrid,
  monthRange,
  MONTHS,
  parseDateRange,
  parseIso,
  suggestRanges,
  todayIST,
  weekday,
  weekRange,
  WEEKDAYS_SHORT,
  type DateRange,
  type IsoDate,
} from "@/lib/dates";
import { useDismiss } from "@/components/utils/useDismiss";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconX } from "@/components/icons";
import { cx } from "@/components/utils/cx";
import { Button, IconButton } from "@/components/ui/Button";
import { FieldLabel, FieldMessage } from "@/components/ui/Field";
import { POPUP, triggerClass, triggerIconClass } from "@/components/utils/styles";
import { txt } from "@/components/utils/txt";

export function DatePicker({
  label,
  help,
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a date",
  hint,
  error,
  clearable = false,
}: {
  label?: ReactNode;
  help?: ReactNode; // shows a "?" tip beside the label
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
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);
  const refs = useMemo(() => [wrap], []);
  useDismiss(open, close, refs);

  return (
    <div className="grid gap-1.5">
      <FieldLabel htmlFor={id} label={label} help={help} />
      <div className="relative" ref={wrap}>
        <button
          ref={trigger}
          id={id}
          type="button"
          className={triggerClass({ open, empty: !value })}
          aria-invalid={error ? true : undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          aria-describedby={hint || error ? `${id}-msg` : undefined}
        >
          <span>{value ? formatDate(value) : txt(placeholder)}</span>
          <IconCalendar className={triggerIconClass()} />
        </button>

        {open && (
          <CalendarPopup
            selected={value ? dayRange(value) : null}
            min={min}
            max={max}
            onPick={(d) => {
              onChange(d);
              close();
            }}
            footer={(today, allowed) => (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!allowed(today)}
                  onClick={() => {
                    onChange(today);
                    close();
                  }}
                >
                  Today
                </Button>
                {clearable && value && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onChange(null);
                      close();
                    }}
                  >
                    Clear
                  </Button>
                )}
              </>
            )}
          />
        )}
      </div>
      <FieldMessage id={id} hint={hint} error={error} />
    </div>
  );
}

/** A filter by a day, a week, a month or a weekday. Type it ("23 Nov", "today", "this week", "November",
 *  "saturday"…): a list under the box offers what the text could mean (lib/dates.ts suggestRanges); arrows move
 *  through it, Enter or a click takes one, and the text is taken by itself as soon as it reads as a date. Leaving the
 *  box with text that isn't a date puts the last date back, so nothing under the field ever moves. The calendar
 *  button is the fallback: a day, Today, This week, This month, Clear. Emptying the box (or ×) clears the filter.
 *  `min` / `max` (e.g. the plan) choose the year when none is typed, bound "every Saturday" and limit the calendar. */
export function DateFilter({
  label,
  help,
  value,
  onChange,
  min,
  max,
  placeholder = "Any date: 23 Nov, Saturday, this week",
  hint,
}: {
  label?: ReactNode;
  help?: ReactNode;
  value: DateRange | null;
  onChange: (r: DateRange | null) => void;
  min?: IsoDate;
  max?: IsoDate;
  placeholder?: string;
  hint?: ReactNode;
}) {
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false); // the calendar
  const [listed, setListed] = useState(false); // the list of suggestions
  const [active, setActive] = useState(0); // the suggestion Enter takes
  const [text, setText] = useState(value ? formatRange(value) : "");
  const [typing, setTyping] = useState(false); // the box has focus, so a new `value` doesn't overwrite the text
  const span = min && max ? { starts_on: min, ends_on: max } : undefined;
  const suggestions = listed
    ? suggestRanges(text === (value ? formatRange(value) : "") ? "" : text, todayIST(), span)
    : [];

  useEffect(() => {
    if (!typing) setText(value ? formatRange(value) : "");
  }, [value, typing]);

  const close = useCallback(() => {
    setOpen(false);
    wrap.current?.querySelector<HTMLButtonElement>("[data-calendar-button]")?.focus();
  }, []);
  const refs = useMemo(() => [wrap], []);
  useDismiss(open, close, refs);

  const same = (a: DateRange | null, b: DateRange | null) =>
    a?.from === b?.from && a?.to === b?.to && a?.weekday === b?.weekday;
  /** Takes `r` (null = no filter), shows it in the box and shuts the list. */
  const take = (r: DateRange | null) => {
    if (!same(r, value)) onChange(r);
    setText(r ? formatRange(r) : "");
    setListed(false);
  };
  /** Leaving the box: an empty box clears, a date is taken, anything else puts the last date back. */
  const settle = () => {
    if (!text.trim()) return take(null);
    take(parseDateRange(text, todayIST(), span) ?? value);
  };

  return (
    <div className="grid gap-1.5">
      <FieldLabel htmlFor={id} label={label} help={help} />
      <div className="relative" ref={wrap}>
        <div className={cx(triggerClass({ open: open || listed, empty: !value }), "cursor-text gap-1 pr-1.5")}>
          <input
            ref={input}
            id={id}
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 truncate bg-transparent text-ink outline-none placeholder:text-gray"
            value={text}
            placeholder={placeholder}
            aria-expanded={listed}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={listed && suggestions[active] ? `${id}-opt-${active}` : undefined}
            aria-describedby={hint ? `${id}-msg` : undefined}
            onFocus={(e) => {
              setTyping(true);
              setListed(true);
              setActive(0);
              e.target.select(); // typing replaces what is there
            }}
            onChange={(e) => {
              const t = e.target.value;
              setText(t);
              setListed(true);
              setActive(0);
              // a date is taken as soon as the text reads as one; the text itself is left alone while typing
              const r = t.trim() ? parseDateRange(t, todayIST(), span) : null;
              if ((r || !t.trim()) && !same(r, value)) onChange(r);
            }}
            onBlur={() => {
              setTyping(false);
              settle();
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && e.altKey) {
                e.preventDefault();
                setListed(false);
                setOpen(true);
              } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && suggestions.length) {
                e.preventDefault();
                const n = suggestions.length;
                setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (listed && suggestions[active]) take(suggestions[active].range);
                else settle();
              } else if (e.key === "Escape") {
                take(value);
              }
            }}
          />
          {value && (
            <IconButton
              className="-my-1.5"
              label="Clear the date"
              size="sm"
              variant="ghost"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => take(null)}
            >
              <IconX />
            </IconButton>
          )}
          <IconButton
            data-calendar-button=""
            className="-my-1.5"
            label="Open the calendar"
            size="sm"
            variant="ghost"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => {
              setListed(false);
              setOpen((o) => !o);
            }}
          >
            <IconCalendar />
          </IconButton>
        </div>

        {listed && (text.trim() || suggestions.length > 0) && (
          <ul id={`${id}-list`} role="listbox" aria-label="Dates" className={cx(POPUP, "right-0 grid gap-0.5 p-1.5")}>
            {suggestions.length === 0 ? (
              <li className="px-2.5 py-2 text-[0.9rem] text-gray">
                {txt(`Nothing matches "${text.trim()}". Try 23 Nov, Saturday, this week or November.`)}
              </li>
            ) : (
              suggestions.map((sg, i) => (
                <li
                  key={sg.label}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={cx(
                    "cursor-pointer rounded-sm px-2.5 py-2 text-[0.92rem] text-ink",
                    i === active && "bg-sheet-2",
                  )}
                  onMouseDown={(e) => e.preventDefault()} // keep focus in the box until the click lands
                  onMouseEnter={() => setActive(i)}
                  onClick={() => take(sg.range)}
                >
                  {txt(sg.label)}
                </li>
              ))
            )}
          </ul>
        )}

        {open && (
          <CalendarPopup
            selected={value}
            min={min}
            max={max}
            onPick={(d) => {
              take(dayRange(d));
              close();
            }}
            footer={(today) => (
              <>
                <span className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      take(dayRange(today));
                      close();
                    }}
                  >
                    Today
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      take(weekRange(today));
                      close();
                    }}
                  >
                    This week
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const { y, m } = parseIso(today);
                      take(monthRange(y, m));
                      close();
                    }}
                  >
                    This month
                  </Button>
                </span>
                {value && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      take(null);
                      close();
                    }}
                  >
                    Clear
                  </Button>
                )}
              </>
            )}
          />
        )}
      </div>
      <FieldMessage id={id} hint={hint} />
    </div>
  );
}

/** The month calendar both fields open. `selected` days are filled (a whole week or month for DateFilter); days
 *  outside min / max can't be picked. `footer` gets today and the "can be picked" test. */
function CalendarPopup({
  selected,
  min,
  max,
  onPick,
  footer,
}: {
  selected: DateRange | null;
  min?: IsoDate;
  max?: IsoDate;
  onPick: (d: IsoDate) => void;
  footer: (today: IsoDate, allowed: (d: IsoDate) => boolean) => ReactNode;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const today = todayIST();
  const allowed = (d: IsoDate) => (!min || d >= min) && (!max || d <= max);
  const clamp = (d: IsoDate) => (min && d < min ? min : max && d > max ? max : d);
  // opens on the picked day, week or month; on today's month for "every Saturday"
  const [cursor, setCursor] = useState<IsoDate>(() =>
    clamp(selected && selected.unit !== "weekday" ? selected.from : today),
  );
  const isSelected = (d: IsoDate) =>
    !!selected &&
    d >= selected.from &&
    d <= selected.to &&
    (selected.unit !== "weekday" || weekday(d) === selected.weekday);

  // move keyboard focus to the cursor day whenever it changes
  useEffect(() => {
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${cursor}"]`)?.focus();
  }, [cursor]);

  const pick = (d: IsoDate) => {
    if (allowed(d)) onPick(d);
  };
  const onKey = (e: KeyboardEvent) => {
    const moves: Record<string, () => IsoDate> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, -1),
      PageDown: () => addMonths(cursor, 1),
      Home: () => addDays(cursor, -weekday(cursor)),
      End: () => addDays(cursor, 6 - weekday(cursor)),
    };
    if (moves[e.key]) {
      e.preventDefault();
      setCursor(clamp(moves[e.key]()));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(cursor);
    }
  };

  const { y, m } = parseIso(cursor);
  const cells = monthGrid(y, m);

  return (
    <div className={cx(POPUP, "w-[304px] max-w-[calc(100vw-32px)] p-3")} role="dialog" aria-label="Choose a date">
      <div className="mb-1.5 flex items-center justify-between">
        <IconButton
          label="Previous month"
          size="sm"
          variant="ghost"
          onClick={() => setCursor(clamp(addMonths(cursor, -1)))}
        >
          <IconChevronLeft />
        </IconButton>
        <span className="font-display text-base font-bold" aria-live="polite">
          {MONTHS[m - 1]} {y}
        </span>
        <IconButton label="Next month" size="sm" variant="ghost" onClick={() => setCursor(clamp(addMonths(cursor, 1)))}>
          <IconChevronRight />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 gap-0.5" ref={grid} role="grid" onKeyDown={onKey}>
        {WEEKDAYS_SHORT.map((w) => (
          <span key={w} className="py-1 text-center text-xs font-bold text-gray" role="columnheader">
            {w.slice(0, 2)}
          </span>
        ))}
        {cells.map(({ date, inMonth }) => (
          <button
            key={date}
            type="button"
            data-date={date}
            role="gridcell"
            className={cx(
              "aspect-square cursor-pointer rounded-full font-body text-[0.9rem] tabular-nums disabled:cursor-not-allowed disabled:line-through disabled:opacity-25",
              isSelected(date)
                ? "bg-accent font-bold text-on-accent"
                : cx("enabled:hover:bg-sheet-2", inMonth ? "text-ink" : "text-gray opacity-55"),
              date === today && "font-bold shadow-[inset_0_0_0_1.5px_var(--accent)]",
            )}
            tabIndex={date === cursor ? 0 : -1}
            disabled={!allowed(date)}
            aria-selected={isSelected(date)}
            aria-label={formatDate(date) + (date === today ? " (today)" : "")}
            onClick={() => pick(date)}
          >
            {parseIso(date).d}
          </button>
        ))}
      </div>
      {/* wraps instead of spilling out of the box when the buttons don't fit on one line */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-line-2 pt-2">
        {footer(today, allowed)}
      </div>
    </div>
  );
}
