// Linking the plan to the question bank. You export your plan and question bank to an AI, the AI matches questions to days,
// and you paste its answer back. The app checks every date and id before saving, so a made-up id can never get in.
// Pure functions, tested by scripts/check.ts.
import type { PackData } from "./packs";
import type { PlanData } from "./plan";
import { difficultyOf } from "./questionFilter";

export interface DayLink { q: string[]; mock?: string; note?: string }
export type Links = Record<string, DayLink>; // date -> what to do that day

const clip = (s: string, n: number) => { const t = s.replace(/!\[[^\]\n]*\]\([^)\s]+\)/g, "[picture]").replace(/```[\s\S]*?```/g, "[code]").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

export interface PromptOptions { withText: boolean; textChars?: number }
/** Past this many characters a prompt is too long to paste into most AI chats, so the app offers two files instead. */
export const PROMPT_LIMIT = 100_000;
export const isTooLong = (text: string): boolean => text.length > PROMPT_LIMIT;

const RULES = `RULES
1. Use only dates that appear in MY PLAN and only ids that appear in MY QUESTIONS and MY MOCK TESTS. Never invent an id or a date.
2. A practice question may appear on more than one day (for revision), but never twice on the same day. Repeat only when it helps: for example, bring back a question you gave earlier on a later revision day.
3. For a study day, choose questions whose topic matches the day's "topics" or its title. Aim for the day's "targetQs"; if that is 0, aim for about 3 questions per planned hour. Give fewer if there are not enough matching questions. Never pad with unrelated topics.
4. Order the work like a learner: easier and 1-mark questions on the first pass of a topic, harder and 2-mark questions on later revision days. Questions about topics I feel "no idea" or "shaky" about deserve more days and more questions than "know" topics.
5. For a mock day (kind "mock"), set "mock" to one id from MY MOCK TESTS. Use each mock test at most once and keep them in order. If there are fewer mock tests than mock days, leave the extra mock days without a mock.
6. Leave exam days and light "taper" days without questions.
7. Reply with ONLY one JSON object (no explanation, no markdown fence) in exactly this shape. List only days that get something:
{ "days": [ { "date": "YYYY-MM-DD", "practice": ["question-id", "question-id"], "mock": "mock-test-id", "note": "optional, under 80 characters, for example: Start with the 1-mark questions" } ] }
"mock" and "note" are optional; "practice" may be an empty list.`;

/** One piece of text to paste into an AI: the instructions, your plan and your question bank. */
export function linkPrompt(plan: PlanData, pack: PackData, opts: PromptOptions = { withText: true }, current: Links = {}): string {
  const chars = opts.textChars ?? 90;
  const days = plan.days.map((d) => ({ date: d.date, kind: d.kind, hours: d.hours, title: d.title, topics: d.topics, targetQs: d.targetQs }));
  const topics = pack.topics.map((t) => `${t.id} | ${t.name} | subject: ${pack.subjects[t.subject] ?? t.subject} | I feel: ${t.status === "noidea" ? "no idea" : t.status}`);
  const questions = pack.questions.map((q) => [q.id, q.topic, q.type, `${q.marks}m`, difficultyOf(q) ?? "-", q.tags?.length ? q.tags.join(",") : "-", ...(opts.withText ? [clip(q.text, chars)] : [])].join(" | "));
  const mocks = (pack.mockTests ?? []).map((m) => `${m.id} | ${m.name} | ${m.sections.reduce((n, s) => n + s.questions.length, 0)} questions | ${m.minutes} minutes`);
  const cur = currentLinks(pack, current);
  return `${INTRO(cur.length > 0)}
${RULES}

MY PLAN (${days.length} days, JSON)
${JSON.stringify(days)}
${cur.length ? `\nMY CURRENT LINKS (${cur.length} days, JSON)\n${JSON.stringify(cur)}\n` : ""}
MY TOPICS (id | name | subject | how I feel)
${topics.join("\n")}

MY QUESTIONS (${pack.questions.length}; id | topic id | type | marks | difficulty | tags${opts.withText ? " | start of the question" : ""})
${questions.join("\n") || "(none)"}

MY MOCK TESTS (id | name | size | time)
${mocks.join("\n") || "(none)"}
`;
}

const INTRO = (improving: boolean) => `I have a study plan and a question bank. Match them: give every study day specific practice questions, and every mock day a specific mock test. The result becomes my day-by-day actionable plan.${improving ? `\n\nI ALREADY HAVE LINKS (see MY CURRENT LINKS). Improve them instead of starting over: keep what is good, fix what is weak, and fill days that have nothing. Your reply is the COMPLETE new list and replaces my current links, so include every day that should keep its questions, even if unchanged.` : ""}
`;

/** The links that still point at something real, in the shape the AI should send back. */
function currentLinks(pack: PackData, current: Links) {
  const have = new Set([...pack.questions.map((q) => q.id), ...(pack.mockTests ?? []).map((m) => m.id)]);
  return Object.entries(current).map(([date, l]) => ({ date, practice: l.q.filter((id) => have.has(id)), ...(l.mock && have.has(l.mock) ? { mock: l.mock } : {}), ...(l.note ? { note: l.note } : {}) })).filter((d) => d.practice.length || d.mock || d.note);
}

// ---------- the two-files route, for banks too big to paste ----------
/** File 1: the plan (and any links already made). */
export function planFile(plan: PlanData, current: Links = {}, pack?: PackData) {
  return {
    file: "plan",
    name: plan.name,
    days: plan.days.map((d) => ({ date: d.date, kind: d.kind, hours: d.hours, title: d.title, topics: d.topics, targetQs: d.targetQs })),
    ...(pack ? { currentLinks: currentLinks(pack, current) } : {}),
  };
}
/** File 2: the question bank, with the full question text but no options, answers or explanations. */
export function bankFile(pack: PackData) {
  return {
    file: "question-bank",
    questionCount: pack.questions.length,
    mockTestCount: (pack.mockTests ?? []).length,
    topics: pack.topics.map((t) => ({ id: t.id, name: t.name, subject: pack.subjects[t.subject] ?? t.subject, feel: t.status === "noidea" ? "no idea" : t.status })),
    questions: pack.questions.map((q) => ({ id: q.id, topic: q.topic, type: q.type, marks: q.marks, difficulty: difficultyOf(q) ?? null, tags: q.tags ?? [], text: q.text })),
    mockTests: (pack.mockTests ?? []).map((m) => ({ id: m.id, name: m.name, questions: m.sections.reduce((n, s) => n + s.questions.length, 0), minutes: m.minutes })),
  };
}
/** The short prompt that goes with the two files. Same rules, same reply shape as the long prompt. */
export function filesPrompt(improving = false): string {
  return `${INTRO(improving)}
I have attached two JSON files:
- plan.json: MY PLAN (a "days" list${improving ? ", plus my current links in \"currentLinks\"" : ""}).
- question-bank.json: MY TOPICS ("topics"), MY QUESTIONS ("questions": id, topic, type, marks, difficulty, tags, text) and MY MOCK TESTS ("mockTests").
Read both files completely before you answer. question-bank.json starts with "questionCount": the "questions" list must have exactly that many entries, so use all of them, not just the first part of the file. If you cannot read the whole file, say so instead of guessing. In the rules below, "MY PLAN", "MY TOPICS", "MY QUESTIONS" and "MY MOCK TESTS" mean those parts of the files.
${RULES}
`;
}

export interface LinkResult { links: Links | null; errors: string[]; warnings: string[]; days: number; questions: number; mocks: number }

/** Checks what the AI sent back against your real plan and pack. Anything not found is dropped and reported. */
export function parseLinks(input: unknown, plan: PlanData, pack: PackData): LinkResult {
  const errors: string[] = [], warnings: string[] = [];
  const fail = (): LinkResult => ({ links: null, errors, warnings, days: 0, questions: 0, mocks: 0 });
  const o = typeof input === "object" && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
  const list = Array.isArray(input) ? input : o && Array.isArray(o.days) ? o.days : null;
  if (!list) { errors.push('The answer must be a JSON object like { "days": [ { "date": "2026-11-08", "practice": ["id"] } ] }.'); return fail(); }

  const dates = new Set(plan.days.map((d) => d.date));
  const practiceIds = new Set(pack.questions.map((q) => q.id));
  const mockQIds = new Set((pack.mockTests ?? []).flatMap((m) => m.sections.flatMap((s) => s.questions.map((q) => q.id))));
  const mockIds = new Set((pack.mockTests ?? []).map((m) => m.id));
  const links: Links = {};
  const used = new Set<string>(), usedMock = new Set<string>();
  const unknown: string[] = [], inMock: string[] = [], badDates: string[] = [], badMocks: string[] = [];

  for (const [i, raw] of list.entries()) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) { warnings.push(`days[${i}] is not an object, so it was skipped.`); continue; }
    const r = raw as Record<string, unknown>;
    const date = typeof r.date === "string" ? r.date : "";
    if (!dates.has(date)) { badDates.push(date || `days[${i}]`); continue; }
    const q: string[] = [];
    const asked = Array.isArray(r.practice) ? r.practice : r.practice === undefined ? [] : null;
    if (asked === null) { warnings.push(`${date}: "practice" must be a list of ids, so it was skipped.`); }
    else for (const id of asked) {
      if (typeof id !== "string") continue;
      if (mockQIds.has(id)) { inMock.push(id); continue; }
      if (!practiceIds.has(id)) { unknown.push(id); continue; }
      if (q.includes(id)) continue;
      used.add(id); q.push(id);
    }
    let mock: string | undefined;
    if (typeof r.mock === "string" && r.mock) {
      if (!mockIds.has(r.mock)) badMocks.push(r.mock);
      else if (usedMock.has(r.mock)) warnings.push(`Mock "${r.mock}" was given to more than one day. Only the first day keeps it.`);
      else { mock = r.mock; usedMock.add(r.mock); }
    }
    const note = typeof r.note === "string" && r.note.trim() ? r.note.trim().slice(0, 100) : undefined;
    if (!q.length && !mock && !note) continue;
    const prev = links[date];
    links[date] = { q: [...new Set([...(prev?.q ?? []), ...q])], mock: mock ?? prev?.mock, note: note ?? prev?.note };
  }

  const sample = (a: string[]) => `${[...new Set(a)].slice(0, 6).join(", ")}${new Set(a).size > 6 ? ", …" : ""}`;
  if (badDates.length) warnings.push(`${new Set(badDates).size} date${new Set(badDates).size === 1 ? " is" : "s are"} not in your plan and ${new Set(badDates).size === 1 ? "was" : "were"} skipped: ${sample(badDates)}.`);
  if (unknown.length) warnings.push(`${new Set(unknown).size} question id${new Set(unknown).size === 1 ? " does" : "s do"} not exist in your question bank and ${new Set(unknown).size === 1 ? "was" : "were"} dropped: ${sample(unknown)}.`);
  if (inMock.length) warnings.push(`${new Set(inMock).size} id${new Set(inMock).size === 1 ? " belongs" : "s belong"} to a mock test, not Practice, and ${new Set(inMock).size === 1 ? "was" : "were"} dropped: ${sample(inMock)}.`);
  if (badMocks.length) warnings.push(`Mock test${new Set(badMocks).size === 1 ? "" : "s"} not found and skipped: ${sample(badMocks)}.`);

  const n = Object.keys(links).length;
  if (n === 0) { errors.push("Nothing usable was found: no date from your plan has a valid question or mock test."); return { ...fail(), warnings }; }
  return { links, errors, warnings, days: n, questions: used.size, mocks: usedMock.size };
}

/** Questions that are still in the pack, in the order the AI listed them. */
export const liveQuestionIds = (link: DayLink | undefined, pack: PackData): { ids: string[]; missing: number } => {
  const have = new Set(pack.questions.map((q) => q.id));
  const ids = (link?.q ?? []).filter((id) => have.has(id));
  return { ids, missing: (link?.q.length ?? 0) - ids.length };
};

/** Reads the text an AI sent back. Strips a code fence and, when the answer was cut off, adds the missing closing brackets. */
export function readAnswer(text: string): { value: unknown; errors: string[]; warnings: string[] } {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return { value: JSON.parse(t), errors: [], warnings: [] }; } catch (e) {
    // walk the text and note which brackets are still open
    const open: string[] = []; let str = false, esc = false;
    for (const c of t) {
      if (str) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') str = false; continue; }
      if (c === '"') str = true;
      else if (c === "{") open.push("}");
      else if (c === "[") open.push("]");
      else if (c === "}" || c === "]") open.pop();
    }
    if (!str && open.length > 0) {
      const fixed = `${t.replace(/,\s*$/, "")}${open.reverse().join("")}`;
      try { return { value: JSON.parse(fixed), errors: [], warnings: [`The answer ended too early. The app added the missing ${[...new Set(open)].join(" and ")} at the end. If days look missing, ask the AI to send the full answer again.`] }; } catch { /* fall through */ }
    }
    const m = /line (\d+) column (\d+)/.exec((e as Error).message);
    return { value: null, errors: [`The answer is not valid JSON${m ? ` (near line ${m[1]}, column ${m[2]})` : ""}. Ask the AI: "Reply again with only the JSON, nothing else", then paste the new reply.`], warnings: [] };
  }
}
