// Edit plan (v1's PlanEdit): the rules a day must meet before it is saved, shared by the editor screen
// (components/planner/EditPlan.tsx) and the plan.saveDay query, which checks again in the worker (AGENTS.md rule 5).
// The limits are the plan file's (lib/planFile.ts LIMITS), so an edited plan always exports and imports again.

import type { IsoDate } from "@/lib/dates";
import { DAY_KINDS, LIMITS, parsePlanFile, type PlanFileDay, type PlanParse } from "@/lib/planFile";
import type { PlanDayKind } from "@/types/tables";

/** One task row in the editor: `id` is the saved task's id (null = new), so its tick follows it. */
export interface TaskRow {
  id: number | null;
  body: string;
}
export interface DayForm {
  title: string;
  kind: PlanDayKind;
  hours: string; // as typed; "" = not given
  note: string;
  tasks: TaskRow[];
  questions: string[]; // linked question ids, in order
}
export interface CheckedDay {
  title: string;
  kind: PlanDayKind;
  hours: number | null;
  note: string | null;
  tasks: TaskRow[];
  questions: string[];
}

/** Checks a day from the editor. Blank task rows are dropped; anything else wrong refuses with a plain message. */
export function checkDay(f: DayForm): { day: CheckedDay | null; errors: string[] } {
  const errors: string[] = [];
  const title = f.title.trim();
  if (!title) errors.push("Give the day a title.");
  else if (title.length > LIMITS.title) errors.push(`The title is longer than ${LIMITS.title} characters.`);
  if (!DAY_KINDS.includes(f.kind)) errors.push(`The type must be one of: ${DAY_KINDS.join(", ")}.`);
  let hours: number | null = null;
  if (f.hours.trim()) {
    hours = Number(f.hours);
    if (!isFinite(hours) || hours < 0 || hours > 24) errors.push("Hours must be a number from 0 to 24.");
  }
  const note = f.note.trim();
  if (note.length > LIMITS.note) errors.push(`The note is longer than ${LIMITS.note} characters.`);
  const tasks = f.tasks.map((t) => ({ id: t.id, body: t.body.trim() })).filter((t) => t.body);
  if (tasks.length > LIMITS.tasks)
    errors.push(`A day holds at most ${LIMITS.tasks} tasks (this one has ${tasks.length}).`);
  const long = tasks.findIndex((t) => t.body.length > LIMITS.task);
  if (long >= 0) errors.push(`Task ${long + 1} is longer than ${LIMITS.task} characters.`);
  const questions = [...new Set(f.questions.map((q) => q.trim()).filter(Boolean))];
  if (questions.length > LIMITS.questions)
    errors.push(`A day links at most ${LIMITS.questions} questions (this one has ${questions.length}).`);
  if (errors.length) return { day: null, errors };
  return { day: { title, kind: f.kind, hours, note: note || null, tasks, questions }, errors };
}

/** Edit plan's "Update days from JSON": reads an orbit-plan file (or just `{ "days": [...] }`) as a patch. Only the
 *  dates it lists are meant to change; the name, description, plan dates and milestones in it are ignored. */
export function parseDayPatch(input: string): PlanParse {
  const text = input
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return parsePlanFile(input); // same plain-English "not valid JSON" refusal as the plan import
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return parsePlanFile(data);
  const {
    name: _n,
    description: _d,
    starts_on: _s,
    ends_on: _e,
    milestones: _m,
    ...rest
  } = data as Record<string, unknown>;
  const r = parsePlanFile({ ...rest, name: "patch" });
  // a patch has no milestones and needs no "format": neither is worth a warning here
  return { ...r, warnings: r.warnings.filter((w) => !w.startsWith("No milestones") && !w.startsWith('"format"')) };
}

/** Which of a patch's days can be applied: inside the plan's dates and not locked. The rest are named in warnings. */
export function splitPatch(
  days: PlanFileDay[],
  plan: { starts_on: IsoDate; ends_on: IsoDate },
  isLocked: (d: IsoDate) => boolean,
): { apply: PlanFileDay[]; warnings: string[] } {
  const outside = days.filter((d) => d.date < plan.starts_on || d.date > plan.ends_on).map((d) => d.date);
  const locked = days
    .filter((d) => d.date >= plan.starts_on && d.date <= plan.ends_on && isLocked(d.date))
    .map((d) => d.date);
  const warnings: string[] = [];
  const list = (a: string[]) => `${a.slice(0, 4).join(", ")}${a.length > 4 ? ` and ${a.length - 4} more` : ""}`;
  if (outside.length)
    warnings.push(`${outside.length} day(s) are outside the plan's dates and were skipped: ${list(outside)}.`);
  if (locked.length)
    warnings.push(`${locked.length} locked day(s) can't be changed and were skipped: ${list(locked)}.`);
  const skip = new Set([...outside, ...locked]);
  return { apply: days.filter((d) => !skip.has(d.date)), warnings };
}

/** Question ids pasted from anywhere (one per line, or separated by commas / spaces), each once. */
export const idsFromText = (s: string): string[] => [
  ...new Set(
    s
      .split(/[\s,;]+/)
      .map((x) => x.replace(/^["'[]+|["'\]]+$/g, "").trim())
      .filter(Boolean),
  ),
];
