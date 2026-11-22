// The prompt Edit plan's "Change days with JSON" tab hands to an AI chat: it gets the plan's open days and writes
// back only the days that change, in a file lib/planEdit.ts parseDayPatch reads. A product feature (AGENTS.md
// rule 9): it must describe parseDayPatch exactly, and scripts/checks/planFile.ts checks that its example passes.
// Change both together. Nothing here may assume a particular exam.

import { addDays, type IsoDate } from "@/lib/dates";
import { DAY_KINDS, LIMITS, PLAN_FORMAT, PLAN_VERSION, WEEKDAY_NAMES, type PlanFileBonus } from "@/lib/planFile";

/** One open day as the AI sees it. */
export interface PatchDay {
  date: IsoDate;
  title: string;
  kind: string;
  hours: number | null;
  note: string | null;
  tasks: string[];
  bonus: PlanFileBonus[]; // bonus work sitting on this day (docs/PLANS.md §5)
}
export interface PatchInput {
  plan: { name: string; description: string | null; starts_on: IsoDate; ends_on: IsoDate };
  days: PatchDay[]; // the days that can still be changed (not locked), in date order
  stuck: (PlanFileBonus & { on: IsoDate })[]; // unfinished bonus work on locked days ("on"), which can be moved
}

/** A small valid reply, dated from `today`: one changed day (with bonus work moved onto it) and a range. */
export function examplePatch(today: IsoDate) {
  return {
    format: PLAN_FORMAT,
    version: PLAN_VERSION,
    days: [
      {
        date: addDays(today, 2),
        title: "Eigenvalues",
        kind: "study",
        hours: 2,
        tasks: ["Work 3 examples", "Practise 10 problems"],
        bonus: [{ from: addDays(today, -1), task: "Revise yesterday's notes" }],
      },
      {
        from: addDays(today, 5),
        to: addDays(today, 9),
        weekdays: ["mon", "wed"],
        title: "Revision",
        kind: "light",
        hours: 1,
        tasks: ["Redo last week's mistakes"],
      },
    ],
  };
}

/** The full prompt text. `today` = the user's date (YYYY-MM-DD, India time). */
export function patchPrompt(today: IsoDate, input: PatchInput): string {
  const days = input.days.map((d) => ({
    date: d.date,
    title: d.title,
    kind: d.kind,
    ...(d.hours !== null ? { hours: d.hours } : {}),
    ...(d.note ? { note: d.note } : {}),
    tasks: d.tasks,
    ...(d.bonus.length ? { bonus: d.bonus } : {}),
  }));
  const stuck = input.stuck.length
    ? `\nUnfinished bonus work still sitting on past (locked) days. You may move any of it onto a day above by adding it to that day's "bonus":\n${JSON.stringify(input.stuck, null, 1)}\n`
    : "";
  return `You are helping me change some days of my study plan in an app called Orbit. Orbit reads your reply as a JSON file and updates ONLY the dates it lists. Every other day stays exactly as it is.

My plan: "${input.plan.name}", from ${input.plan.starts_on} to ${input.plan.ends_on}. Today is ${today}.${input.plan.description ? `\nWhat it is for: ${input.plan.description}` : ""}

STEP 1: ASK ME FIRST. Ask me (in one short list) what I want to change: which dates or topics, and why (a missed week, an exam moved, more or fewer hours, a new topic). Wait for my answer. Change as little as possible and keep everything else as it is.

STEP 2: WRITE THE FILE. Reply with ONLY the JSON (no explanation before or after), so I can paste it into Orbit.

Here are my days that can still be changed (past days and today's locked day are left out; don't list them). This is how they are now:
${JSON.stringify(days, null, 1)}
${stuck}
"bonus" is unfinished work carried over from an earlier day: each item is a task (by its exact text) or a linked question (by id) of its "from" day. It stays on its own day too; doing it ticks it there. It never counts toward the day it sits on.

The format:
{
  "format": "${PLAN_FORMAT}",
  "version": ${PLAN_VERSION},
  "days": [
    {
      "date": "YYYY-MM-DD",     // EITHER "date" OR both "from" and "to" (a range, with an optional "weekdays" filter: ${WEEKDAY_NAMES.join(", ")})
      "title": text,            // required, up to ${LIMITS.title} characters
      "kind": text,             // optional, default "study". one of: ${DAY_KINDS.join(", ")}
      "hours": number,          // optional, 0 to 24
      "tasks": [text],          // optional, at most ${LIMITS.tasks}, each non-empty, up to ${LIMITS.task} characters
      "note": text,             // optional, up to ${LIMITS.note} characters
      "bonus": [                // optional, only on a single "date". The day's bonus work, at most ${LIMITS.bonus}
        { "from": "YYYY-MM-DD", "task": text },        // a task of that earlier day, its text copied exactly, or
        { "from": "YYYY-MM-DD", "question": text }     // a question id linked to that earlier day
      ]
    }
  ]
}

How it works:
- List ONLY the days that change. A day you list is REPLACED by what you write: give its full title, kind, hours, note and ALL its tasks (the ones that stay too). Leave out "questions": Orbit then keeps the questions already linked to that day.
- Bonus work: leave out "bonus" and the day keeps its bonus work. Give "bonus" and it becomes exactly that list: an item you leave out is taken off the day, an item from another day's list (or from the past days above) MOVES here. To move bonus work, list its day without that item and the receiving day with it. Copy "from" and the task text or question id exactly; "from" must be a day that is over (before ${today}).
- To add a day that isn't in my plan, list it with a date between ${input.plan.starts_on} and ${input.plan.ends_on}. To keep a task ticked, repeat its text exactly.
- Don't list days that don't change. Don't write "name", "description" or "milestones": they are ignored.
- Dates are YYYY-MM-DD, from ${addDays(today, 0)} on. Past days can't be changed.
- Text may use Markdown (**bold**, *italic*) and LaTeX between dollar signs ($x^2$). In JSON every backslash must be doubled: write "$\\\\frac{a}{b}$", not "$\\frac{a}{b}$".
- Valid JSON only: double quotes, no comments, no trailing commas.

A small example of a valid reply:
${JSON.stringify(examplePatch(today), null, 2)}
`;
}
