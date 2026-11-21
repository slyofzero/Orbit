// Link questions (v1's "Improve plan" / LinkPlan, lib/links.ts): hand an AI chat the plan and the question bank,
// it picks questions for each day, and its reply is pasted back. Every date and id in the reply is checked against
// the real plan and bank before anything is saved (AGENTS.md rule 5), so a made-up id can never get in.
// Pure functions; the data comes from the plan.linkInput query, the reply is saved by plan.applyLinks.
// The reply shape is { "days": [ { "date": "YYYY-MM-DD", "questions": ["question id", …] } ] }, the same
// "questions" field a plan file's days use (lib/planFile.ts). A product feature (rule 9): the prompt, the files
// and parseLinks change together; scripts/checks/planner.ts tests them. Nothing here may assume a particular exam.

import type { IsoDate } from "@/lib/dates";
import { LIMITS } from "@/lib/planFile";
import type { PlanDayKind, QuestionType, TopicRating } from "@/types/tables";

export interface LinkInput {
  plan: { name: string; description: string | null };
  days: { date: IsoDate; kind: PlanDayKind; hours: number | null; title: string | null; tasks: string[] }[];
  topics: { id: string; name: string; subject: string; rating: TopicRating | null }[];
  questions: {
    id: string;
    topic_id: string;
    type: QuestionType;
    marks: number;
    difficulty: string;
    tags: string[];
    text: string;
  }[];
  /** the links there are now, per day (only days that have some) */
  current: { date: IsoDate; questions: string[] }[];
  /** days whose links can't change: past days, and today after the lock hour (lib/dashboard.ts dayLock) */
  locked: IsoDate[];
}

/** Past this many characters a prompt is too long to paste into most AI chats, so two files are offered instead. */
export const PROMPT_LIMIT = 100_000;
export const isTooLong = (text: string): boolean => text.length > PROMPT_LIMIT;
const TEXT_CHARS = 90;

/** A question's text shortened to one line: pictures and code blocks become [picture] / [code]. */
export function clip(s: string, n = TEXT_CHARS): string {
  const t = s
    .replace(/!\[[^\]\n]*\]\([^)\s]+\)/g, "[picture]")
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

const feel = (r: TopicRating | null) => (r === "no_idea" ? "no idea" : (r ?? "not rated"));
/** The days the AI may change: not locked. */
const openDays = (x: LinkInput) => {
  const locked = new Set(x.locked);
  return x.days.filter((d) => !locked.has(d.date));
};
const dayRow = (d: LinkInput["days"][number]) => ({
  date: d.date,
  kind: d.kind,
  hours: d.hours,
  title: d.title,
  tasks: d.tasks.map((t) => clip(t, 160)),
});

const RULES = `RULES
1. Use only dates that appear in MY PLAN and only ids that appear in MY QUESTIONS. Never invent an id or a date.
2. A question may appear on more than one day (for revision), but never twice on the same day. Repeat only when it helps: for example, bring back a question from an earlier day on a later revision day.
3. For a study day, choose questions whose topic matches the day's title and tasks. Aim for about 3 questions per planned hour (if "hours" is empty, about 6). Give fewer if there are not enough matching questions. Never pad with unrelated topics.
4. Order the work like a learner: easier and lower-mark questions on the first pass of a topic, harder and higher-mark questions on later revision days. Topics I feel "no idea" or "shaky" about deserve more days and more questions than "know" topics.
5. Leave exam days, mock test days and light taper days without questions, unless their tasks ask for practice.
6. At most ${LIMITS.questions} questions on one day.
7. Reply with ONLY one JSON object (no explanation, no markdown fence) in exactly this shape. List only days that get questions:
{ "days": [ { "date": "YYYY-MM-DD", "questions": ["question-id", "question-id"] } ] }`;

const intro = (improving: boolean) =>
  `I have a study plan and a question bank. Match them: give every study day specific practice questions from my bank. The result becomes my day-by-day plan of what to solve.${
    improving
      ? `\n\nI ALREADY HAVE LINKS (see MY CURRENT LINKS). Improve them instead of starting over: keep what is good, fix what is weak, and fill days that have nothing. Your reply is the COMPLETE new list and replaces my current links, so include every day that should keep its questions, even if unchanged.`
      : ""
  }
`;

/** One piece of text to paste into an AI: the instructions, the plan's open days and the question bank. */
export function linkPrompt(x: LinkInput): string {
  const days = openDays(x);
  const open = new Set(days.map((d) => d.date));
  const current = x.current.filter((c) => open.has(c.date));
  const topics = x.topics.map((t) => `${t.id} | ${t.name} | subject: ${t.subject} | I feel: ${feel(t.rating)}`);
  const questions = x.questions.map((q) =>
    [q.id, q.topic_id, q.type, `${q.marks}m`, q.difficulty, q.tags.join(",") || "-", clip(q.text)].join(" | "),
  );
  return `${intro(current.length > 0)}
${RULES}

${x.plan.description ? `ABOUT MY PLAN (in my own words)\n${x.plan.description}\n\n` : ""}MY PLAN (${days.length} days, JSON)
${JSON.stringify(days.map(dayRow))}
${current.length ? `\nMY CURRENT LINKS (${current.length} days, JSON)\n${JSON.stringify(current)}\n` : ""}
MY TOPICS (id | name | subject | how I feel)
${topics.join("\n") || "(none)"}

MY QUESTIONS (${x.questions.length}; id | topic id | type | marks | difficulty | tags | start of the question)
${questions.join("\n") || "(none)"}
`;
}

/** The two-files route, for banks too big to paste: plan.json and question-bank.json, plus a short prompt. */
export function linkFiles(x: LinkInput) {
  const days = openDays(x);
  const open = new Set(days.map((d) => d.date));
  const current = x.current.filter((c) => open.has(c.date));
  return {
    plan: {
      file: "plan",
      name: x.plan.name,
      ...(x.plan.description ? { description: x.plan.description } : {}),
      days: days.map(dayRow),
      ...(current.length ? { currentLinks: current } : {}),
    },
    bank: {
      file: "question-bank",
      questionCount: x.questions.length,
      topics: x.topics.map((t) => ({ id: t.id, name: t.name, subject: t.subject, feel: feel(t.rating) })),
      questions: x.questions.map((q) => ({
        id: q.id,
        topic: q.topic_id,
        type: q.type,
        marks: q.marks,
        difficulty: q.difficulty,
        tags: q.tags,
        text: q.text,
      })),
    },
    prompt: filesPrompt(current.length > 0),
  };
}

export function filesPrompt(improving: boolean): string {
  return `${intro(improving)}
I have attached two JSON files:
- plan.json: MY PLAN (a "days" list, and a "description" in my own words about what the plan is for${improving ? ', plus my current links in "currentLinks"' : ""}).
- question-bank.json: MY TOPICS ("topics") and MY QUESTIONS ("questions": id, topic, type, marks, difficulty, tags, text).
Read both files completely before you answer. question-bank.json starts with "questionCount": the "questions" list must have exactly that many entries, so use all of them, not just the first part of the file. If you cannot read the whole file, say so instead of guessing. In the rules below, "MY PLAN", "MY TOPICS" and "MY QUESTIONS" mean those parts of the files.
${RULES}
`;
}

/** Reads the text an AI sent back: strips a code fence and, when the answer was cut off, adds the missing brackets. */
export function readAnswer(text: string): { value: unknown; errors: string[]; warnings: string[] } {
  const t = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return { value: JSON.parse(t), errors: [], warnings: [] };
  } catch (e) {
    // walk the text and note which brackets are still open
    const open: string[] = [];
    let str = false;
    let esc = false;
    for (const c of t) {
      if (str) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') str = false;
        continue;
      }
      if (c === '"') str = true;
      else if (c === "{") open.push("}");
      else if (c === "[") open.push("]");
      else if (c === "}" || c === "]") open.pop();
    }
    if (!str && open.length > 0) {
      const fixed = `${t.replace(/,\s*$/, "")}${[...open].reverse().join("")}`;
      try {
        return {
          value: JSON.parse(fixed),
          errors: [],
          warnings: [
            `The answer ended too early, so the missing ${[...new Set(open)].join(" and ")} were added at the end. If days look missing, ask the AI to send the full answer again.`,
          ],
        };
      } catch {
        /* fall through */
      }
    }
    const m = /line (\d+) column (\d+)/.exec(e instanceof Error ? e.message : "");
    return {
      value: null,
      errors: [
        `The answer is not valid JSON${m ? ` (near line ${m[1]}, column ${m[2]})` : ""}. Ask the AI: "Reply again with only the JSON, nothing else", then paste the new reply.`,
      ],
      warnings: [],
    };
  }
}

export interface LinkCheck {
  /** the links to save, one entry per day that gets questions, in the AI's order (null = refused) */
  links: { date: IsoDate; questions: string[] }[] | null;
  errors: string[];
  warnings: string[];
  days: number;
  questions: number; // different questions
}

/** What the reply is checked against: the plan's dates, the ids that may be linked, and the locked days. */
export interface LinkRules {
  dates: Set<IsoDate>;
  practice: Set<string>; // question ids that can be linked (practice pool, not retired)
  mock: Set<string>; // ids of mock-only questions: reported apart, they can't be linked
  locked: Set<IsoDate>;
}

/** Checks what the AI sent back. Anything not found is dropped and reported; nothing usable at all refuses. */
export function parseLinks(input: unknown, r: LinkRules): LinkCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (): LinkCheck => ({ links: null, errors, warnings, days: 0, questions: 0 });
  const o =
    typeof input === "object" && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
  const list = Array.isArray(input) ? input : o && Array.isArray(o.days) ? o.days : null;
  if (!list) {
    errors.push('The answer must be a JSON object like { "days": [ { "date": "2026-11-08", "questions": ["id"] } ] }.');
    return fail();
  }

  const byDate = new Map<IsoDate, string[]>();
  const used = new Set<string>();
  const unknown: string[] = [];
  const inMock: string[] = [];
  const badDates: string[] = [];
  const lockedDates: string[] = [];
  let cut = 0;

  list.forEach((raw, i) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      return void warnings.push(`days[${i}] is not an object, so it was skipped.`);
    const d = raw as Record<string, unknown>;
    const date = typeof d.date === "string" ? d.date.trim() : "";
    if (!r.dates.has(date)) return void badDates.push(date || `days[${i}]`);
    if (r.locked.has(date)) return void lockedDates.push(date);
    const asked = d.questions ?? d.practice; // v1 replies said "practice"
    if (asked !== undefined && !Array.isArray(asked))
      return void warnings.push(`${date}: "questions" must be a list of ids, so it was skipped.`);
    const q = byDate.get(date) ?? [];
    for (const raw of (asked as unknown[] | undefined) ?? []) {
      if (typeof raw !== "string") continue;
      const id = raw.trim();
      if (r.mock.has(id)) inMock.push(id);
      else if (!r.practice.has(id)) unknown.push(id);
      else if (q.includes(id)) continue;
      else if (q.length >= LIMITS.questions) cut++;
      else {
        q.push(id);
        used.add(id);
      }
    }
    if (q.length) byDate.set(date, q);
  });

  const n = (a: string[]) => new Set(a).size;
  const sample = (a: string[]) => `${[...new Set(a)].slice(0, 6).join(", ")}${n(a) > 6 ? ", …" : ""}`;
  const was = (a: string[], one: string, many: string) => (n(a) === 1 ? one : many);
  if (badDates.length)
    warnings.push(
      `${n(badDates)} date${was(badDates, " is", "s are")} not in your plan and ${was(badDates, "was", "were")} skipped: ${sample(badDates)}.`,
    );
  if (lockedDates.length)
    warnings.push(
      `${n(lockedDates)} day${was(lockedDates, " is", "s are")} locked (over, or today after the lock hour), so ${was(lockedDates, "it keeps its", "they keep their")} links: ${sample(lockedDates)}.`,
    );
  if (unknown.length)
    warnings.push(
      `${n(unknown)} question id${was(unknown, " does", "s do")} not exist in your question bank and ${was(unknown, "was", "were")} dropped: ${sample(unknown)}.`,
    );
  if (inMock.length)
    warnings.push(
      `${n(inMock)} id${was(inMock, " belongs", "s belong")} to a mock test, not practice, and ${was(inMock, "was", "were")} dropped: ${sample(inMock)}.`,
    );
  if (cut) warnings.push(`${cut} question(s) were left out: a day holds at most ${LIMITS.questions}.`);

  if (byDate.size === 0) {
    errors.push("Nothing usable was found: no open day of your plan got a question from your bank.");
    return fail();
  }
  const links = [...byDate].map(([date, questions]) => ({ date, questions }));
  return { links, errors, warnings, days: links.length, questions: used.size };
}
