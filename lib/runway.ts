// The dashboard hero (v1's "runway") as pure functions: the countdown headline, the plan note, the
// day track with milestone flags, today's tasks and the streak. No clock reads: `today` is passed in.

import { addDays, daysBetween, type IsoDate } from "@/lib/dates";
import type { PlanDayKind, PlanDayStatus } from "@/types/tables";

export interface HeroDay {
  on_date: IsoDate;
  title: string | null;
  kind: PlanDayKind;
  status: PlanDayStatus | null; // from plan_day_progress; null = nothing planned
  tasks_total: number;
  tasks_done: number;
}
export interface HeroMilestone {
  id: number;
  name: string;
  on_date: IsoDate;
}
export interface HeroInput {
  today: IsoDate;
  plan: { starts_on: IsoDate; ends_on: IsoDate } | null;
  days: HeroDay[]; // the plan's days, in date order
  milestones: HeroMilestone[]; // in date order
}

/** One tick per day: done / miss / past (neither) / today / milestone / future. */
export type TickState = "done" | "miss" | "past" | "today" | "ms" | "future";

export interface Flag {
  id: number;
  name: string;
  pct: number; // where it sits along the track, 0–100
  long: string; // "15 days to go" / "today" / "passed"
  short: string; // "15d" / "today" / "passed" (phones)
  next: boolean; // the next milestone to come
  flip: boolean; // near the right end: label hangs to the left
  level: 0 | 1; // alternate rows on phones
}

export interface Hero {
  /** The headline: count down to `name`, or a message when there's nothing to count down to. */
  headline:
    | { kind: "none" } // "Add a milestone to start the countdown"
    | { kind: "past" } // "Every milestone is behind you"
    | { kind: "today" | "tomorrow"; name: string }
    | { kind: "in"; name: string; days: number };
  sub: string; // plan note + "After that: …"
  ticks: { date: IsoDate; state: TickState }[];
  flags: Flag[];
  todayTasks: { done: number; total: number } | null; // null = nothing planned today
  streak: number;
}

const inDays = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Days in a row with everything done, ending today (docs/PLANS.md §4): rest days are skipped and
 *  today only counts once it is done. */
export function streak(days: readonly HeroDay[], today: IsoDate): number {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d.on_date > today || d.status === null) continue;
    if (d.status === "done") n++;
    else if (d.on_date === today) continue;
    else break;
  }
  return n;
}

/** v1's tick colour for a past day: green when everything got done, plain when the tasks are done but
 *  linked questions are still open (or it's an exam day / nothing planned), red otherwise. */
function pastState(d: HeroDay | undefined): TickState {
  if (!d || d.kind === "exam" || d.status === null) return "past";
  if (d.status === "done") return "done";
  return d.tasks_done >= d.tasks_total ? "past" : "miss";
}

export function buildHero({ today, plan, days, milestones }: HeroInput): Hero {
  const byDate = new Map(days.map((d) => [d.on_date, d]));
  const t = byDate.get(today);

  // plan note
  let note: string;
  if (!plan) note = "Load a plan to see your daily targets here.";
  else if (today < plan.starts_on)
    note = `Your plan starts ${inDays(daysBetween(today, plan.starts_on))}${days[0]?.title ? `: ${days[0].title}` : ""}.`;
  else if (today > plan.ends_on) note = "The plan is finished. Keep revising your mistake log.";
  else
    note = `Day ${daysBetween(plan.starts_on, today) + 1} of ${daysBetween(plan.starts_on, plan.ends_on) + 1}. ${plural(
      t ? Math.max(0, t.tasks_total - t.tasks_done) : 0,
      "task",
    )} left today.`;

  // countdown
  const upcoming = milestones.filter((m) => m.on_date >= today);
  const next = upcoming[0];
  const after = upcoming.slice(1);
  const n = next ? daysBetween(today, next.on_date) : 0;
  const headline: Hero["headline"] = !milestones.length
    ? { kind: "none" }
    : !next
      ? { kind: "past" }
      : n === 0
        ? { kind: "today", name: next.name }
        : n === 1
          ? { kind: "tomorrow", name: next.name }
          : { kind: "in", name: next.name, days: n };
  const afterText = after.length
    ? ` After that: ${after
        .slice(0, 3)
        .map((m) => `${m.name} in ${daysBetween(today, m.on_date)} days`)
        .join(", ")}${after.length > 3 ? ` and ${after.length - 3} more` : ""}.`
    : "";

  // track: from today (or the plan's first day, if it already started) to the last milestone
  const ticks: Hero["ticks"] = [];
  const flags: Flag[] = [];
  if (milestones.length) {
    const start = plan && plan.starts_on < today ? plan.starts_on : today;
    const end = milestones[milestones.length - 1].on_date;
    const total = Math.min(1000, Math.max(1, daysBetween(start, end) + 1));
    const msDates = new Set(milestones.map((m) => m.on_date));
    for (let i = 0; i < total; i++) {
      const date = addDays(start, i);
      ticks.push({
        date,
        state: msDates.has(date)
          ? "ms"
          : date === today
            ? "today"
            : date < today
              ? pastState(byDate.get(date))
              : "future",
      });
    }
    milestones.forEach((m, k) => {
      const idx = daysBetween(start, m.on_date);
      if (idx < 0 || idx >= total) return;
      const pct = ((idx + 0.5) / total) * 100;
      const d = daysBetween(today, m.on_date);
      flags.push({
        id: m.id,
        name: m.name,
        pct,
        long: d < 0 ? "passed" : d === 0 ? "today" : `${plural(d, "day")} to go`,
        short: d < 0 ? "passed" : d === 0 ? "today" : `${d}d`,
        next: next?.id === m.id,
        flip: pct > 74,
        level: (k % 2) as 0 | 1,
      });
    });
  }

  return {
    headline,
    sub: note + afterText,
    ticks,
    flags,
    todayTasks: t && t.tasks_total > 0 ? { done: t.tasks_done, total: t.tasks_total } : null,
    streak: streak(days, today),
  };
}
