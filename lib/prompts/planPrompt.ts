// The prompt the user pastes into any AI chat to get a plan file Orbit can import.
// It is a product feature (AGENTS.md rule 9): it must describe lib/planFile.ts exactly, and
// scripts/check.ts checks that its example passes the importer. Change both together.
// Nothing here may assume a particular exam: Orbit works for any goal.

import { addDays, type IsoDate } from "@/lib/dates";
import { DAY_KINDS, LIMITS, PLAN_FORMAT, PLAN_VERSION, WEEKDAY_NAMES } from "@/lib/planFile";

/** A small, valid example plan, dated from `today` so the AI sees realistic dates. */
export function examplePlan(today: IsoDate) {
  const d = (n: number) => addDays(today, n);
  return {
    format: PLAN_FORMAT,
    version: PLAN_VERSION,
    name: "Linear algebra in four weeks",
    description: "Two hours on weekdays, light review on Saturdays, Sundays off.",
    starts_on: d(1),
    ends_on: d(28),
    milestones: [
      { name: "Weekly quiz", short: "Quiz", date: d(12), note: "Vectors and matrices" },
      { name: "Final exam", short: "Final", date: d(28), note: "Everything" },
    ],
    days: [
      {
        from: d(1),
        to: d(11),
        weekdays: ["mon", "tue", "wed", "thu", "fri"],
        title: "Vectors and matrices",
        kind: "study",
        hours: 2,
        tasks: ["Read one section of the notes", "Solve 8 practice problems", "Write down every mistake"],
      },
      {
        from: d(1),
        to: d(27),
        weekdays: ["sat"],
        title: "Light review",
        kind: "light",
        hours: 1,
        tasks: ["Redo last week's mistakes"],
      },
      { date: d(12), title: "Weekly quiz", kind: "exam", hours: 1, tasks: ["Take the quiz", "Mark what went wrong"] },
      {
        from: d(13),
        to: d(25),
        weekdays: ["mon", "tue", "wed", "thu", "fri"],
        title: "Eigenvalues: $A\\mathbf{v} = \\lambda\\mathbf{v}$",
        kind: "study",
        hours: 2,
        tasks: ["Work 3 examples by hand", "Practise 10 problems"],
      },
      { from: d(26), to: d(27), title: "Final revision", kind: "taper", hours: 2, tasks: ["One timed practice paper"] },
      { date: d(28), title: "Final exam", kind: "exam", tasks: ["Sleep well the night before"] },
    ],
  };
}

const KIND_MEANING: Record<(typeof DAY_KINDS)[number], string> = {
  study: "a normal full study day",
  light: "a lighter day (revision, catching up)",
  mock: "a day for a full practice test",
  crunch: "a short day when time is tight",
  buffer: "a spare day to catch up or rest",
  exam: "the day of a test, quiz or exam",
  taper: "the last easy days before a big exam",
};

/** The full prompt text. `today` = the user's date (YYYY-MM-DD, India time). */
export function planPrompt(today: IsoDate): string {
  return `You are helping me make a day-by-day study plan for an app called Orbit. Orbit imports the plan from a JSON file you write.

STEP 1: ASK ME FIRST. Before writing anything, ask me (in one short list):
1. What I'm preparing for, and the dates of any exams, quizzes or deadlines.
2. The date I want to start (today is ${today}) and the date the plan should end.
3. How many hours I can study on weekdays and on weekends, and which days I want off.
4. The subjects and topics to cover, and which ones I find hard or haven't started.
5. Anything else that matters (holidays, busy weeks, a preferred order).
Wait for my answers. Then plan in this order: hardest topics early, regular revision, practice tests before big exams, easy days just before an exam.

STEP 2: WRITE THE FILE. Reply with ONLY the JSON (no explanation before or after), so I can save it as "my-plan.json".

The format:
{
  "format": "${PLAN_FORMAT}",
  "version": ${PLAN_VERSION},
  "name": "short name for the plan (at most ${LIMITS.name} characters)",
  "description": "one or two sentences: what it's for and how it's paced (optional)",
  "starts_on": "YYYY-MM-DD (optional; default: the first day listed)",
  "ends_on": "YYYY-MM-DD (optional; default: the last day listed)",
  "milestones": [ { "name": "…", "short": "a tag of at most ${LIMITS.milestoneShort} characters (optional)", "date": "YYYY-MM-DD", "note": "… (optional)" } ],
  "days": [ … ]
}

Each entry in "days" is EITHER one date OR a range:
- One date: { "date": "YYYY-MM-DD", "title": "…", "kind": "…", "hours": 2, "tasks": ["…"], "note": "…" }
- A range:  { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "weekdays": ["mon","tue","wed","thu","fri"], "title": "…", "kind": "…", "hours": 2, "tasks": ["…"] }
  "weekdays" (optional) keeps only those days of the week: ${WEEKDAY_NAMES.map((w) => `"${w}"`).join(", ")}. Leave it out to include every day.
- If a date is covered by a single "date" entry AND a range, the single date wins. If two ranges overlap, the later one wins.
- Dates with no entry are rest days. Don't list rest days.

Fields of a day:
- "title" (required): what the day is about, at most ${LIMITS.title} characters.
- "kind" (optional, default "study"): ${DAY_KINDS.map((k) => `"${k}" = ${KIND_MEANING[k]}`).join("; ")}.
- "hours" (optional): a number from 0 to 24.
- "tasks" (optional): up to ${LIMITS.tasks} short, concrete checklist items I can tick off, e.g. "Solve 10 problems on limits" (not "Study limits").
- "note" (optional): extra guidance for the day.
- "questions" (optional): ids of questions from my question pack to practise that day. Leave it out unless I give you the ids.

Rules:
- Dates are YYYY-MM-DD. The whole plan is at most ${LIMITS.days} days, and every day must fall between "starts_on" and "ends_on".
- Add a milestone for every exam or deadline I mention, and an "exam" day on the same date.
- Text may use Markdown (**bold**, *italic*) and LaTeX between dollar signs ($x^2$). In JSON every backslash must be doubled: write "$\\\\frac{a}{b}$", not "$\\frac{a}{b}$".
- Valid JSON only: double quotes, no comments, no trailing commas.

A small example of a valid file:
${JSON.stringify(examplePlan(today), null, 2)}
`;
}
