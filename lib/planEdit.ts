// Edit plan (v1's PlanEdit): the rules a day must meet before it is saved, shared by the editor screen
// (components/planner/EditPlan.tsx) and the plan.saveDay query, which checks again in the worker (AGENTS.md rule 5).
// The limits are the plan file's (lib/planFile.ts LIMITS), so an edited plan always exports and imports again.

import { DAY_KINDS, LIMITS } from "@/lib/planFile";
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

/** Question ids pasted from anywhere (one per line, or separated by commas / spaces), each once. */
export const idsFromText = (s: string): string[] => [
  ...new Set(
    s
      .split(/[\s,;]+/)
      .map((x) => x.replace(/^["'[]+|["'\]]+$/g, "").trim())
      .filter(Boolean),
  ),
];
