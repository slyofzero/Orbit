"use client";
// v1's month calendar: a 6×7 grid (Monday first) with ‹ Today › above it. Each day can be tinted, ticked
// (done ✓) and tagged (a small red label, e.g. a milestone); today's number glows highlighter yellow.
// Pure display: what a day holds comes in through `days`, and clicking a day calls `onSelect`.

import { useState, type ReactNode } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { cx } from "@/components/utils/cx";
import { txt } from "@/components/utils/txt";
import { MONTHS, WEEKDAYS_SHORT, addMonths, formatDate, monthGrid, parseIso, type IsoDate } from "@/lib/dates";

export type CalendarTone = "blue" | "green" | "amber" | "accent" | "red" | "hi" | "neutral";

/** What one date shows. `tag` = a small red label at the bottom (and a red ring), e.g. a milestone's name.
 *  `label` is read out by screen readers after the date. */
export type CalendarDay = { tone?: CalendarTone; done?: boolean; tag?: string; label?: string };

const TINT: Record<CalendarTone, string> = {
  blue: "bg-blue-soft",
  green: "bg-green-soft",
  amber: "bg-amber-soft",
  accent: "bg-accent-soft",
  red: "bg-red-soft",
  hi: "bg-hi-soft",
  neutral: "bg-sheet-2",
};
const DOT: Record<CalendarTone, string> = {
  blue: "bg-blue",
  green: "bg-green",
  amber: "bg-amber",
  accent: "bg-accent",
  red: "bg-red",
  hi: "bg-hi",
  neutral: "bg-gray",
};

const CELL =
  "relative flex min-h-[70px] cursor-pointer flex-col items-center gap-[3px] rounded-[14px] border-0 px-[7px] py-1.5 font-body text-ink transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.3,1.6,0.5,1)] hover:z-2 hover:-translate-y-[3px] hover:scale-[1.04] hover:shadow-[0_8px_18px_-8px_var(--accent),inset_0_0_0_1.5px_var(--accent)] max-[560px]:min-h-[52px] max-[560px]:rounded-[10px]";

const firstOf = (d: IsoDate) => d.slice(0, 8) + "01";

export function Calendar({
  today,
  selected,
  onSelect,
  days = {},
  legend,
  actions,
}: {
  today: IsoDate;
  selected: IsoDate;
  onSelect: (date: IsoDate) => void;
  days?: Record<IsoDate, CalendarDay>;
  /** the key under the grid: one coloured dot per entry */
  legend?: { tone: CalendarTone; label: ReactNode }[];
  /** extra buttons in the header, after › */
  actions?: ReactNode;
}) {
  // The month shown follows the selected day; ‹ › move it without changing the selection.
  const [view, setView] = useState(firstOf(selected));
  const [seen, setSeen] = useState(selected);
  if (seen !== selected) {
    setSeen(selected);
    setView(firstOf(selected));
  }
  const { y, m } = parseIso(view);
  const grid = monthGrid(y, m);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Heading level={2} className="min-w-0 flex-1">
          {`${MONTHS[m - 1]} ${y}`}
        </Heading>
        <IconButton label="Previous month" className="size-9" onClick={() => setView(addMonths(view, -1))}>
          <IconChevronLeft />
        </IconButton>
        <Button
          variant="soft"
          size="sm"
          onClick={() => {
            setView(firstOf(today));
            onSelect(today);
          }}
        >
          Today
        </Button>
        <IconButton label="Next month" className="size-9" onClick={() => setView(addMonths(view, 1))}>
          <IconChevronRight />
        </IconButton>
        {actions}
      </div>

      <div className="grid grid-cols-7 gap-[5px] max-[560px]:gap-[3px]">
        {WEEKDAYS_SHORT.map((w) => (
          <span key={w} className="px-1 py-2 text-center text-[0.82rem] font-bold text-gray">
            {w}
          </span>
        ))}
        {grid.map(({ date, inMonth }) => {
          const d = days[date];
          const isToday = date === today;
          const isSelected = date === selected;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${formatDate(date)}${isToday ? ", today" : ""}${d?.label ? `: ${d.label}` : ""}${d?.done ? ", done" : ""}${d?.tag ? `, ${d.tag}` : ""}`}
              onClick={() => onSelect(date)}
              className={cx(
                CELL,
                !inMonth
                  ? "bg-transparent text-gray opacity-55"
                  : isSelected
                    ? "bg-sheet"
                    : d?.tone
                      ? TINT[d.tone]
                      : "bg-sheet",
                isSelected
                  ? "shadow-[0_0_0_2.5px_var(--accent),0_10px_20px_-10px_var(--accent)]"
                  : d?.tag
                    ? "shadow-[inset_0_0_0_1.5px_var(--red)]"
                    : inMonth && "shadow-[inset_0_0_0_1px_var(--line-2)]",
              )}
            >
              <span
                className={cx(
                  "grid size-[30px] place-items-center rounded-full font-display text-[1.05rem] tabular-nums",
                  d?.tone ? "font-bold" : "font-medium",
                  isToday && "animate-today-pulse bg-hi font-bold text-hero",
                )}
              >
                {parseIso(date).d}
              </span>
              {d?.done && (
                <span aria-hidden className="absolute top-[7px] right-[8px] text-[0.8rem] font-extrabold text-green">
                  ✓
                </span>
              )}
              {d?.tag && (
                <span className="absolute bottom-[5px] max-w-[calc(100%-8px)] truncate rounded-full bg-red px-2 text-[0.7rem] leading-[1.5] font-extrabold text-white">
                  {txt(d.tag)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {legend && legend.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[0.82rem] text-gray">
          {legend.map((l, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <span className={cx("size-2 rounded-full", DOT[l.tone])} />
              {txt(l.label)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
