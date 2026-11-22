// Manage pack (/practice/manage, v1's PackManager): the rules behind its screens, as pure functions.
//   * The question editor's form ↔ one question of the question file (lib/questionFile.ts). Saving runs the
//     very same checks as an import (parseQuestionFile), so a broken question can never be saved.
//   * Export: the bank (or one pack) back out as an "orbit-questions" file that imports again.
// Queries: lib/db/queries/manage.ts. Tests: scripts/checks/manage.ts.

import {
  DIFFICULTIES,
  LIMITS,
  PACK_FORMAT,
  PACK_VERSION,
  parseQuestionFile,
  type FileQuestion,
} from "@/lib/questionFile";
import type { QuestionDetail } from "@/lib/questions";
import type { Difficulty, QuestionPool, QuestionRow, QuestionType, StrMatch } from "@/types/tables";

/** The Manage pack sections, kept in the address (?tab=). */
export const MANAGE_TABS = ["questions", "mock-tests", "topics", "upload"] as const;
export type ManageTab = (typeof MANAGE_TABS)[number];
/** The Questions tab's banks. Every question is in exactly one: Mock = mock-only questions, Programming = code
 *  questions, Practice = the rest (lib/db/queries/manage.ts BANK_SQL). */
export const QUESTION_BANKS = ["practice", "programming", "mock"] as const;
export type QuestionBank = (typeof QUESTION_BANKS)[number];
export const BANK_LABEL: Record<QuestionBank, string> = {
  practice: "Practice",
  programming: "Programming",
  mock: "Mock",
};

/** What you must type to delete the whole question bank (Manage pack → Delete pack). */
export const DELETE_PHRASE = "delete pack";
/** What you must type to delete every mock test (Manage pack → Mock tests → Delete all mock tests). */
export const DELETE_MOCKS_PHRASE = "delete all mocks";
/** What you must type to empty one bank of the Questions tab: "empty practice", "empty programming", "empty mock". */
export const emptyPhrase = (bank: QuestionBank) => `empty ${bank}`;
/** True when the typed text is the phrase (spaces around it and capitals don't matter). */
export const isPhrase = (typed: string, phrase: string) => typed.trim().toLowerCase() === phrase;
export const isDeletePhrase = (typed: string) => isPhrase(typed, DELETE_PHRASE);

/** How many rows one page of the Questions tab shows. */
export const MANAGE_PAGE = 20;

/** The pager of a list: how many pages `total` rows make, the page asked for kept inside them (0-based; a list
 *  that shrank, e.g. after a delete, falls back to its last page), and the rows it shows (1-based, for "21–40"). */
export function pageOf(total: number, page: number, size = MANAGE_PAGE) {
  const pages = Math.max(1, Math.ceil(total / size));
  const at = Math.min(Math.max(0, Math.floor(page) || 0), pages - 1);
  return {
    pages,
    page: at,
    offset: at * size,
    first: total ? at * size + 1 : 0,
    last: Math.min(total, (at + 1) * size),
  };
}

export const letter = (i: number) => String.fromCharCode(65 + i);

// ---------------------------------------------------------------------------------------------------------------
// Mock tests (Manage pack → Mock tests): the same limits as the importer (lib/questionFile.ts).

/** The details on a mock test's card, as typed. */
export interface MockForm {
  name: string;
  minutes: string;
  instructions: string;
}
export type MockCheck =
  | { ok: true; name: string; minutes: number; instructions: string | null }
  | { ok: false; error: string };

/** Checks a mock's details like an import would: a name, whole minutes from 1 to LIMITS.minutes, instructions
 *  that fit. Blank instructions = none. */
export function checkMock(f: MockForm): MockCheck {
  const name = f.name.trim();
  if (!name) return { ok: false, error: "Give the mock test a name." };
  if (name.length > LIMITS.mockName) return { ok: false, error: `A name is at most ${LIMITS.mockName} characters.` };
  const raw = f.minutes.trim();
  const minutes = Number(raw);
  if (!raw || !Number.isInteger(minutes) || minutes < 1 || minutes > LIMITS.minutes)
    return { ok: false, error: `Minutes must be a whole number from 1 to ${LIMITS.minutes}.` };
  const instructions = f.instructions.trim();
  if (instructions.length > LIMITS.instructions)
    return { ok: false, error: `The instructions are longer than ${LIMITS.instructions} characters.` };
  return { ok: true, name, minutes, instructions: instructions || null };
}

/** A section's name, trimmed; an error text when it is empty or too long. */
export function checkSectionName(name: string): { ok: true; name: string } | { ok: false; error: string } {
  const n = name.trim();
  if (!n) return { ok: false, error: "A section needs a name." };
  if (n.length > LIMITS.mockName)
    return { ok: false, error: `A section name is at most ${LIMITS.mockName} characters.` };
  return { ok: true, name: n };
}

/** The list with item `i` moved one place up (-1) or down (1); unchanged when it can't move. */
export function moveIn<T>(list: readonly T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return [...list];
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Everything the question editor's boxes hold, as typed (numbers stay text until saved). */
export interface QuestionForm {
  type: QuestionType;
  topicId: string;
  difficulty: Difficulty | "";
  marks: string;
  negativeMarks: string;
  text: string;
  explanation: string;
  options: string[]; // mcq / msq
  picked: number[]; // mcq / msq: the right options (mcq: one)
  natValue: string;
  natTol: string;
  strAnswers: string; // one accepted answer per line
  strMatch: StrMatch;
  strCase: boolean;
  starter: string; // code
  tags: string; // comma separated
}

/** A blank form: an mcq with four empty options, option A ticked (v1). */
export function emptyForm(topicId: string): QuestionForm {
  return {
    type: "mcq",
    topicId,
    difficulty: "",
    marks: "1",
    negativeMarks: "0",
    text: "",
    explanation: "",
    options: ["", "", "", ""],
    picked: [0],
    natValue: "",
    natTol: "0",
    strAnswers: "",
    strMatch: "exact",
    strCase: false,
    starter: "",
    tags: "",
  };
}

/** The form for a saved question. */
export function formOf(q: QuestionRow, d: QuestionDetail, tags: string[]): QuestionForm {
  const f: QuestionForm = {
    ...emptyForm(q.topic_id),
    type: q.type,
    difficulty: q.difficulty,
    marks: String(q.marks),
    negativeMarks: String(q.negative_marks),
    text: q.stem,
    explanation: q.explanation ?? "",
    tags: tags.join(", "),
  };
  if ("options" in d) {
    f.options = [...d.options];
    f.picked = typeof d.correct === "number" ? [d.correct] : [...d.correct];
  } else if ("tolerance" in d) {
    f.natValue = String(d.value);
    f.natTol = String(d.tolerance);
  } else if ("accepted" in d) {
    f.strAnswers = d.accepted.join("\n");
    f.strMatch = d.match;
    f.strCase = d.case_sensitive;
  } else f.starter = d.starter ?? "";
  return f;
}

/** Switching the type keeps what still fits: an mcq keeps only one ticked option. */
export function changeType(f: QuestionForm, type: QuestionType): QuestionForm {
  return { ...f, type, picked: type === "mcq" ? (f.picked.length ? f.picked.slice(0, 1) : [0]) : f.picked };
}
/** Ticks an option: mcq = this one only; msq = toggles it. */
export function toggleRight(f: QuestionForm, i: number): QuestionForm {
  if (f.type === "mcq") return { ...f, picked: [i] };
  const picked = f.picked.includes(i) ? f.picked.filter((x) => x !== i) : [...f.picked, i].sort((a, b) => a - b);
  return { ...f, picked };
}
/** Removes an option; ticks after it move up with it. */
export function dropOption(f: QuestionForm, i: number): QuestionForm {
  return {
    ...f,
    options: f.options.filter((_, k) => k !== i),
    picked: f.picked.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)),
  };
}

const num = (s: string): number | string => (s.trim() !== "" && isFinite(Number(s)) ? Number(s) : s);
export const splitTags = (s: string) =>
  s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/** The form as one question of the question file, ready for parseQuestionFile. */
export function fileQuestionOf(f: QuestionForm, subject: string, topic: string, pool: QuestionPool) {
  const raw: Record<string, unknown> = {
    subject,
    topic,
    type: f.type,
    difficulty: f.difficulty || undefined,
    marks: num(f.marks),
    negative_marks: f.negativeMarks.trim() === "" ? 0 : num(f.negativeMarks),
    text: f.text,
    explanation: f.explanation,
    pool,
  };
  const tags = splitTags(f.tags);
  if (tags.length) raw.tags = tags;
  if (f.type === "mcq")
    Object.assign(raw, { options: f.options, answer: f.picked.length ? letter(f.picked[0]) : null });
  else if (f.type === "msq") Object.assign(raw, { options: f.options, answer: f.picked.map(letter) });
  else if (f.type === "nat")
    Object.assign(raw, { answer: num(f.natValue), tolerance: f.natTol.trim() === "" ? 0 : num(f.natTol) });
  else if (f.type === "str") {
    const lines = f.strAnswers
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    Object.assign(raw, { answer: lines, match: f.strMatch, case_sensitive: f.strCase });
  } else raw.starter = f.starter;
  return raw;
}

const FIELD: Record<string, string> = {
  text: "The question",
  options: "The options",
  answer: "The right answer",
  marks: "Marks",
  negative_marks: "Negative marks",
  tolerance: "The allowed error",
  match: "How it is compared",
  case_sensitive: "Case matters",
  explanation: "The explanation",
  tags: "Tags",
  starter: "The starter code",
  difficulty: "Difficulty",
  type: "The type",
};

/** The importer speaks of `questions[0].answer`; the editor has boxes with names. */
export function friendlyError(e: string): string {
  const m = /^questions\[0\](?: \("[^"]*"\))?(?:\.(\w+))?:? ?([\s\S]*)$/.exec(e);
  if (!m) return e;
  const [, field, rest] = m;
  if (!field) {
    if (/needs a "text"/.test(rest)) return "Write the question.";
    return `This question ${rest}`.replace(/^This question an option/, "An option");
  }
  return `${FIELD[field] ?? field} ${rest}`;
}

/** Checks the form exactly like an import would. `question` is null when anything is wrong. */
export function checkForm(
  f: QuestionForm,
  subject: string,
  topic: string,
  pool: QuestionPool,
): { question: FileQuestion | null; errors: string[] } {
  const errors: string[] = [];
  if (!f.difficulty) errors.push("Pick a difficulty: easy, medium or hard.");
  if (splitTags(f.tags).length > LIMITS.tags) errors.push(`Use at most ${LIMITS.tags} tags.`);
  const r = parseQuestionFile({
    format: PACK_FORMAT,
    version: PACK_VERSION,
    name: "Edit",
    questions: [fileQuestionOf(f, subject, topic, pool)],
  });
  errors.push(...r.errors.map(friendlyError));
  const question = r.file?.questions[0] ?? null;
  return { question: errors.length ? null : question, errors };
}

// ---------------------------------------------------------------------------------------------------------------
// Export

/** One question as the export query reads it. */
export interface ExportQuestion {
  id: string;
  subject: string;
  topic: string;
  question: Pick<QuestionRow, "type" | "difficulty" | "marks" | "negative_marks" | "stem" | "explanation" | "pool">;
  detail: QuestionDetail;
  tags: string[];
}
export interface ExportMock {
  name: string;
  instructions: string | null;
  minutes: number;
  full_screen: boolean;
  sections: { name: string; minutes: number | null; questions: string[] }[];
}

/** An "orbit-questions" file (lib/questionFile.ts) holding these questions and mocks; it imports again as is.
 *  Question ids are the bank's own, so the mocks can name them. Empty sections and mocks are left out (the
 *  importer refuses them). */
export function exportFile(name: string, questions: ExportQuestion[], mocks: ExportMock[]) {
  const has = new Set(questions.map((q) => q.id));
  const out = questions.map(({ id, subject, topic, question: q, detail: d, tags }) => {
    const row: Record<string, unknown> = {
      id,
      subject,
      topic,
      type: q.type,
      difficulty: q.difficulty,
      marks: q.marks,
      negative_marks: q.negative_marks,
      text: q.stem,
    };
    if ("options" in d) {
      row.options = d.options;
      row.answer = typeof d.correct === "number" ? letter(d.correct) : d.correct.map(letter);
    } else if ("tolerance" in d) Object.assign(row, { answer: d.value, tolerance: d.tolerance });
    else if ("accepted" in d)
      Object.assign(row, {
        answer: d.accepted.length === 1 ? d.accepted[0] : d.accepted,
        match: d.match,
        case_sensitive: d.case_sensitive,
      });
    else if (d.starter) row.starter = d.starter;
    if (q.explanation) row.explanation = q.explanation;
    if (tags.length) row.tags = tags;
    if (q.pool !== "practice") row.pool = q.pool;
    return row;
  });
  const outMocks = mocks
    .map((m) => ({
      name: m.name,
      minutes: m.minutes,
      ...(m.instructions ? { instructions: m.instructions } : {}),
      full_screen: m.full_screen, // always written: left out means full screen
      sections: m.sections
        .map((s) => ({
          name: s.name,
          ...(s.minutes ? { minutes: s.minutes } : {}),
          questions: s.questions.filter((id) => has.has(id)),
        }))
        .filter((s) => s.questions.length),
    }))
    .filter((m) => m.sections.length);
  return {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    name: name.slice(0, LIMITS.name) || "Orbit questions",
    questions: out,
    ...(outMocks.length ? { mocks: outMocks } : {}),
  };
}

/** A file name from a pack name: "Linear algebra!" → "linear-algebra.json". */
export function fileNameOf(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "orbit-questions"}.json`;
}

/** A question as one short line for a table cell (v1's QPreview): code blocks become "[code]", display maths
 *  inline, block markdown (headings, lists, quotes) plain; cut to `max` characters, never inside $…$. */
export function previewText(text: string, max = 90): string {
  let s = text
    .replace(/```[\s\S]*?(```|$)/g, " [code] ")
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, m: string) => `$${m.trim()}$`)
    .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length <= max) return s;
  let cut = s.slice(0, max);
  const dollars = (t: string) => (t.match(/(?<!\\)\$/g) ?? []).length;
  while (dollars(cut) % 2 === 1) cut = cut.slice(0, cut.search(/(?<!\\)\$[^$]*$/));
  const space = cut.lastIndexOf(" ");
  if (space >= max * 0.5) cut = cut.slice(0, space);
  s = cut.trimEnd();
  return `${s}…`;
}

/** The labels the editor's and the list's type pickers show (v1). */
export const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "MCQ (one right option)",
  msq: "MSQ (several right options)",
  nat: "NAT (typed number)",
  str: "Text answer (typed text)",
  code: "Programming (write code, self-marked)",
};
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
export { DIFFICULTIES };
