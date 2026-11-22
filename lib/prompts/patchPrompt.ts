// The prompt Edit plan's "Change days with JSON" tab hands to an AI chat: it gets the plan's open days and writes
// back only the days that change, in a file lib/planEdit.ts parseDayPatch reads. A product feature (AGENTS.md
// rule 9): it must describe parseDayPatch exactly, and scripts/checks/planFile.ts checks that its example passes.
// Change both together. Nothing here may assume a particular exam.

import { addDays, type IsoDate } from "@/lib/dates";
import { DAY_KINDS, LIMITS, PLAN_FORMAT, PLAN_VERSION, WEEKDAY_NAMES } from "@/lib/planFile";

/** One open day as the AI sees it. */
export interface PatchDay {
  date: IsoDate;
  title: string;
  kind: string;
  hours: number | null;
  note: string | null;
  tasks: string[];
}
export interface PatchInput {
  plan: { name: string; description: string | null; starts_on: IsoDate; ends_on: IsoDate };
  days: PatchDay[]; // the days that can still be changed (not locked), in date order
}

/** A small valid reply, dated from `today`: one changed day and a range. */
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
  }));
  return `You are helping me change some days of my study plan in an app called Orbit. Orbit reads your reply as a JSON file and updates ONLY the dates it lists. Every other day stays exactly as it is.

My plan: "${input.plan.name}", from ${input.plan.starts_on} to ${input.plan.ends_on}. Today is ${today}.${input.plan.description ? `\nWhat it is for: ${input.plan.description}` : ""}

STEP 1: ASK ME FIRST. Ask me (in one short list) what I want to change: which dates or topics, and why (a missed week, an exam moved, more or fewer hours, a new topic). Wait for my answer. Change as little as possible and keep everything else as it is.

STEP 2: WRITE THE FILE. Reply with ONLY the JSON (no explanation before or after), so I can paste it into Orbit.

Here are my days that can still be changed (past days and today's locked day are left out; don't list them). This is how they are now:
${JSON.stringify(days, null, 1)}

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
      "note": text              // optional, up to ${LIMITS.note} characters
    }
  ]
}

How it works:
- List ONLY the days that change. A day you list is REPLACED by what you write: give its full title, kind, hours, note and ALL its tasks (the ones that stay too). Leave out "questions": Orbit then keeps the questions already linked to that day.
- To add a day that isn't in my plan, list it with a date between ${input.plan.starts_on} and ${input.plan.ends_on}. To keep a task ticked, repeat its text exactly.
- Don't list days that don't change. Don't write "name", "description" or "milestones": they are ignored.
- Dates are YYYY-MM-DD, from ${addDays(today, 0)} on. Past days can't be changed.
- Text may use Markdown (**bold**, *italic*) and LaTeX between dollar signs ($x^2$). In JSON every backslash must be doubled: write "$\\\\frac{a}{b}$", not "$\\frac{a}{b}$".
- Valid JSON only: double quotes, no comments, no trailing commas.

A small example of a valid reply:
${JSON.stringify(examplePatch(today), null, 2)}
`;
}
