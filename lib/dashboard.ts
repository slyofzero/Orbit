// The dashboard's small rules (v1), as pure functions: which day the agenda opens on, the day lock,
// the "Last 7 days" bars, and the "Where you stand" sentence. No clock reads: `today` / `hour` are passed in.

import { addDays, formatLong, weekday, type IsoDate } from "@/lib/dates";
import type { PlanDayStatus } from "@/types/tables";

/** v1: today's tasks and linked questions can't be changed after this hour (IST). */
export const LOCK_HOUR = 9;

/** open = today before LOCK_HOUR · locked = today after it, or a past day · free = a future day. */
export type DayLock = "open" | "locked" | "free";

export function dayLock(date: IsoDate, today: IsoDate, hour: number): DayLock {
  if (date > today) return "free";
  if (date < today) return "locked";
  return hour < LOCK_HOUR ? "open" : "locked";
}

/** The agenda opens on today, or on tomorrow once today is done and tomorrow is planned (v1 "Today is done"). */
export function focusDay(
  today: IsoDate,
  todayStatus: PlanDayStatus | null | undefined,
  tomorrowPlanned: boolean,
): IsoDate {
  return todayStatus === "done" && tomorrowPlanned ? addDays(today, 1) : today;
}

/** "Today" / "Tomorrow" / "Friday 20 November". */
export function dayHeading(date: IsoDate, today: IsoDate): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  return formatLong(date);
}

const LETTER = ["M", "T", "W", "T", "F", "S", "S"];

/** The 7 days ending today, oldest first, with how much got done each day (missing dates = 0). */
export function lastDays(
  today: IsoDate,
  counts: Record<IsoDate, number>,
  n = 7,
): { date: IsoDate; letter: string; value: number; today: boolean }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - (n - 1));
    return { date, letter: LETTER[weekday(date)], value: counts[date] ?? 0, today: date === today };
  });
}

/** A "Last 7 days" bar's hover text: "3 tasks ticked · 1 question answered" / "Nothing done". */
export function dayTally(tasks: number, questions: number): string {
  const parts = [
    tasks && `${tasks} ${tasks === 1 ? "task" : "tasks"} ticked`,
    questions && `${questions} ${questions === 1 ? "question" : "questions"} answered`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nothing done";
}

/** v1's "Where you stand" sentence: plan tasks on days up to today that aren't ticked yet. */
export function standingLine(s: { hasPlan: boolean; started: boolean; openTasks: number }): string {
  if (!s.hasPlan) return "No plan loaded yet.";
  if (!s.started) return "Nothing is due yet.";
  if (s.openTasks === 0) return "Everything due so far is done.";
  return `${s.openTasks} due so far ${s.openTasks === 1 ? "is" : "are"} still open.`;
}

/** "Of 40 topics, 12 are new to you and 5 are shaky." (empty when there are no topics) */
export function topicsLine(t: { topics: number; fresh: number; shaky: number }): string {
  if (!t.topics) return "";
  return `Of ${t.topics} topics, ${t.fresh} ${t.fresh === 1 ? "is" : "are"} new to you and ${t.shaky} ${t.shaky === 1 ? "is" : "are"} shaky.`;
}

/** The day as a prompt for any AI chat (v1's "Copy this day" button). Leaner than v1's for now: no question
 *  texts, milestones or topic feelings yet; those join it in the functionality pass. */
export function dayHelpPrompt(d: {
  date: IsoDate;
  kindLabel: string;
  hours: number | null;
  title: string | null;
  note: string | null;
  tasks: string[];
  topics: string[];
  questions: number;
}): string {
  const h = d.hours ? `${d.hours} hour${d.hours === 1 ? "" : "s"}` : "";
  return `I am following a study plan and I want help getting through ONE day of it.

THE DAY: ${formatLong(d.date)} (${d.date}). Day type: ${d.kindLabel}.${h ? ` Time available: ${h}.` : ""}
${d.title ? `Plan for the day: ${d.title}\n` : ""}${d.note ? `Note: ${d.note}\n` : ""}
TASKS
${d.tasks.map((t, i) => `${i + 1}. ${t}`).join("\n") || "(none)"}
${d.topics.length ? `\nTOPICS\n${d.topics.map((t) => `- ${t}`).join("\n")}\n` : ""}${d.questions > 0 ? `\nPRACTICE: ${d.questions} questions are planned for this day.\n` : ""}
WHAT I NEED FROM YOU
1. A time-boxed schedule${h ? ` that fits ${h}` : ""}, with a short break plan.
2. For each task: exactly how to do it. The concepts I must know, the key formulas or steps, and one worked example.
3. The mistakes people commonly make on these topics, and how to avoid them.
4. A few practice problems on these topics, easiest first. Do NOT give final answers unless I ask.
5. A 5-question quick self-test for the end of the day, and how I can tell that I am done.

Keep it concrete and practical. If you need something from me before you start, ask first.
`;
}
