// The planner page's small rules (v1), as pure functions: the 3-day window, card labels, day states,
// the "Full plan" months and weeks, the month strip and the missed list. No clock reads: `today` is passed in.

import { MONTHS, addDays, formatDate, formatLong, formatShort, parseIso, weekday, type IsoDate } from "@/lib/dates";
import type { PlanDayKind, PlanDayStatus } from "@/types/tables";

/** One plan day with its progress counts (the `planner.days` query). */
export interface PlannerDay {
  on_date: IsoDate;
  title: string | null;
  kind: PlanDayKind;
  hours: number | null;
  status: PlanDayStatus | null;
  tasks_total: number;
  tasks_done: number;
  questions_total: number;
  questions_done: number;
}

/** The "Next 3 days" window: `n` dates starting `offset` days from today. */
export function windowDays(today: IsoDate, offset: number, n = 3): IsoDate[] {
  return Array.from({ length: n }, (_, i) => addDays(today, offset + i));
}

/** The "Next 3 days" carousel: the centre date (today moved `offset` days) and `reach` dates either side,
 *  each with its place (`pos` 0 = centre, −1 / 1 = the side cards, further = off screen, waiting to
 *  slide in). Keyed by date, so a card keeps its element as it slides from one place to the next. */
export function carouselDays(today: IsoDate, offset: number, reach = 2): { date: IsoDate; pos: number }[] {
  return windowDays(today, offset - reach, reach * 2 + 1).map((date, i) => ({ date, pos: i - reach }));
}

/** A day card's heading (v1): "Today" / "Tomorrow" / "Yesterday", else the weekday ("Monday"). */
export function cardLabel(date: IsoDate, today: IsoDate): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  return formatLong(date).split(" ")[0];
}

/** won = everything done · missed = a past day left unfinished (exam days never count as missed) ·
 *  partial = some done, not over yet · pending = nothing done yet · rest = nothing planned. */
export type DayState = "won" | "missed" | "partial" | "pending" | "rest";

export function dayState(d: Pick<PlannerDay, "on_date" | "status" | "kind">, today: IsoDate): DayState {
  if (d.status === null) return "rest";
  if (d.status === "done") return "won";
  if (d.on_date < today && d.kind !== "exam") return "missed";
  return d.status === "partial" ? "partial" : "pending";
}

const itemsDone = (d: PlannerDay) => d.tasks_done + d.questions_done;
const itemsTotal = (d: PlannerDay) => d.tasks_total + d.questions_total;

/** A row's count: "✓" once done, else "2/5" (tasks and linked questions together); "" for a rest day. */
export function dayCount(d: PlannerDay): string {
  const total = itemsTotal(d);
  if (!total) return "";
  return d.status === "done" ? "✓" : `${itemsDone(d)}/${total}`;
}

/** Past days left unfinished, oldest first. */
export function missedDays<D extends PlannerDay>(days: D[], today: IsoDate): D[] {
  return days.filter((d) => dayState(d, today) === "missed");
}

/** The Monday of the week a date is in. */
export const weekStart = (date: IsoDate): IsoDate => addDays(date, -weekday(date));

export interface PlanMonth<D> {
  key: string; // "2026-11"
  label: string; // "November 2026"
  from: IsoDate;
  to: IsoDate;
  /** open by default: the month holding today, or the first month before the plan starts */
  current: boolean;
  days: D[];
  weeks: { start: IsoDate; label: string; days: D[] }[];
}

/** "Full plan": the days (sorted by date) grouped by calendar month, then by week (Monday first). */
export function groupByMonth<D extends { on_date: IsoDate }>(days: D[], today: IsoDate): PlanMonth<D>[] {
  const months: PlanMonth<D>[] = [];
  for (const d of days) {
    const key = d.on_date.slice(0, 7);
    let m = months[months.length - 1];
    if (!m || m.key !== key) {
      const { y, m: mo } = parseIso(d.on_date);
      m = { key, label: `${MONTHS[mo - 1]} ${y}`, from: d.on_date, to: d.on_date, current: false, days: [], weeks: [] };
      months.push(m);
    }
    m.days.push(d);
    m.to = d.on_date;
    const ws = weekStart(d.on_date);
    const w = m.weeks[m.weeks.length - 1];
    if (w && w.start === ws) w.days.push(d);
    else m.weeks.push({ start: ws, label: `Week of ${formatShort(ws)}`, days: [d] });
  }
  const now = months.find((m) => m.key === today.slice(0, 7));
  if (now) now.current = true;
  else if (months.length && today < months[0].from) months[0].current = true;
  return months;
}

export type StripState = "won" | "missed" | "partial" | "none";

/** v1's month strip: one segment per day (exam days left out), as wide as its number of items. */
export function stripSegments(
  days: PlannerDay[],
  today: IsoDate,
): { key: IsoDate; weight: number; state: StripState; part: number }[] {
  return days
    .filter((d) => d.kind !== "exam")
    .map((d) => {
      const total = itemsTotal(d);
      const part = total ? itemsDone(d) / total : 0;
      const s = dayState(d, today);
      const state: StripState = s === "won" ? "won" : s === "missed" ? "missed" : part > 0 ? "partial" : "none";
      return { key: d.on_date, weight: Math.max(total, 1), state, part };
    });
}

/** The strip's screen-reader text: "12 of 26 days done, 3 missed". */
export function stripLabel(segments: { state: StripState }[]): string {
  const won = segments.filter((s) => s.state === "won").length;
  const missed = segments.filter((s) => s.state === "missed").length;
  return `${won} of ${segments.length} days done${missed ? `, ${missed} missed` : ""}`;
}

/** What an empty day card says after "Nothing is planned for this day." */
export function emptyDayNote(date: IsoDate, plan: { starts_on: IsoDate; ends_on: IsoDate }): string {
  if (date < plan.starts_on) return `Your plan starts on ${formatDate(plan.starts_on)}.`;
  if (date > plan.ends_on) return "The plan has ended.";
  return "";
}
