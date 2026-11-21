// The question file Orbit imports ("orbit-questions", version 1): what an AI chat writes for the user and the
// Practice screens read. One format serves all three Practice tabs (topics, programming, mocks); the file
// may hold any mix. It maps onto the question and mock tables (types/tables/questions, types/tables/mocks):
//
//   { "format": "orbit-questions", "version": 1, "name": "…",
//     "questions": [
//       { "id": "la-1", "subject": "Linear Algebra", "topic": "Eigenvalues", "type": "mcq", "difficulty": "easy",
//         "marks": 1, "negative_marks": 0.33, "text": "…", "options": ["…", "…"], "answer": "B",
//         "explanation": "…", "tags": ["conceptual"], "pool": "practice" } ],
//     "mocks": [ { "name": "…", "minutes": 180, "instructions": "…", "full_screen": false,
//                  "sections": [ { "name": "…", "minutes": 60, "questions": ["la-1", …] } ] } ] }
//
// Answers by type: mcq "answer" = one letter ("A"…) or 0-based number · msq = a list of those · nat = a number
// (+ "tolerance") · str = a text or list of accepted texts (+ "match", "case_sensitive") · code = no answer,
// the "explanation" holds the model solution, optional "starter" code.
// Validation refuses with plain-English errors (AGENTS.md rule 5): nothing half-checked is saved.
// The AI prompt that describes this format is lib/prompts/questionsPrompt.ts: change both together.

import { repairBackslashes } from "@/lib/planFile";
import type { Difficulty, QuestionPool, QuestionType, StrMatch } from "@/types/tables";

export const PACK_FORMAT = "orbit-questions";
export const PACK_VERSION = 1;
export const QUESTION_TYPES: readonly QuestionType[] = ["mcq", "msq", "nat", "str", "code"];
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];
export const POOLS: readonly QuestionPool[] = ["practice", "mock"];
export const STR_MATCHES: readonly StrMatch[] = ["exact", "list", "set"];
export const LIMITS = {
  questions: 3000,
  mocks: 50,
  sections: 12,
  name: 80,
  subject: 60,
  topic: 100,
  tags: 8,
  tag: 30,
  text: 6000,
  explanation: 6000,
  option: 600,
  minOptions: 2,
  maxOptions: 10,
  accepted: 20,
  acceptedText: 200,
  starter: 4000,
  mockName: 80,
  instructions: 3000,
  minutes: 600,
} as const;
const MAX_ERRORS = 12;

type Base = {
  /** The file's own label for the question (only mocks refer to it); never saved. */
  ref: string | null;
  subject: string;
  topic: string;
  pool: QuestionPool;
  difficulty: Difficulty;
  marks: number;
  negative_marks: number;
  stem: string;
  explanation: string | null;
  tags: string[];
};
type Detail =
  | { type: "mcq"; options: string[]; correct: number }
  | { type: "msq"; options: string[]; correct: number[] }
  | { type: "nat"; value: number; tolerance: number }
  | { type: "str"; match: StrMatch; case_sensitive: boolean; accepted: string[] }
  | { type: "code"; starter: string | null };
export type FileQuestion = Base & Detail;

export interface FileMockSection {
  name: string;
  minutes: number | null;
  questions: string[]; // refs of questions in this file
}
export interface FileMock {
  name: string;
  instructions: string | null;
  minutes: number;
  full_screen: boolean;
  sections: FileMockSection[];
}
export interface QuestionFile {
  name: string;
  questions: FileQuestion[]; // duplicates inside the file are already dropped
  mocks: FileMock[];
  /** ref of a dropped duplicate → ref of the copy kept (mocks use the kept one). */
  merged: Record<string, string>;
}
export interface QuestionParse {
  file: QuestionFile | null; // null = refused; see errors
  errors: string[];
  warnings: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Finds true duplicates: the same kind of question with the same words and the same answer. Stored in
 *  questions.content_hash. (53-bit string hash: only to spot repeats, never for security.) */
export function questionHash(q: FileQuestion): string {
  const { type } = q;
  const detail =
    type === "mcq"
      ? [q.options, q.correct]
      : type === "msq"
        ? [q.options, [...q.correct].sort()]
        : type === "nat"
          ? [q.value, q.tolerance]
          : type === "str"
            ? [q.match, q.case_sensitive, q.accepted]
            : [q.starter];
  const s = JSON.stringify([type, q.stem.toLowerCase().replace(/\s+/g, " ").trim(), detail]);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return "c" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** "B" / "b" → 1, 2 → 2; anything else → null. */
function choiceIndex(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0) return v;
  if (typeof v === "string" && /^[A-Za-z]$/.test(v.trim())) return v.trim().toUpperCase().charCodeAt(0) - 65;
  return null;
}

/** Reads a question file (its text, or already-parsed JSON) and checks every rule. */
export function parseQuestionFile(input: unknown): QuestionParse {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => {
    if (errors.length < MAX_ERRORS) errors.push(m);
    else if (errors.length === MAX_ERRORS) errors.push("…and more. Fix these first.");
  };
  const refused = (): QuestionParse => ({ file: null, errors, warnings });

  // ----- text → JSON (AI chats often wrap the file in ``` fences) -----
  let data = input;
  if (typeof input === "string") {
    const text = input
      .trim()
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/, "");
    try {
      data = JSON.parse(text);
    } catch (e) {
      err(
        `This isn't valid JSON (${e instanceof Error ? e.message : String(e)}). Ask the AI for "only the JSON, with every backslash doubled (\\\\frac, not \\frac)".`,
      );
      return refused();
    }
  }
  if (!isObj(data)) {
    err('The file must be one JSON object: { "format": "orbit-questions", "name": …, "questions": […] }.');
    return refused();
  }
  const o = data;

  let fixedSlashes = 0;
  const clean = (v: string) => {
    const r = repairBackslashes(v.trim());
    fixedSlashes += r.fixed;
    return r.text;
  };

  // ----- header -----
  if (o.format === undefined)
    warnings.push('"format": "orbit-questions" is missing; the file was read as an Orbit question file anyway.');
  else if (o.format !== PACK_FORMAT) err(`"format" must be "${PACK_FORMAT}" (this file says "${String(o.format)}").`);
  if (o.version !== undefined && o.version !== PACK_VERSION)
    err(`"version" ${String(o.version)} isn't supported; this Orbit reads version ${PACK_VERSION}.`);
  if (typeof o.name !== "string" || !o.name.trim()) err('The file needs a "name", e.g. "name": "Linear algebra pack".');
  const name = typeof o.name === "string" ? clean(o.name).slice(0, LIMITS.name) : "";

  const rawQuestions = o.questions === undefined ? [] : o.questions;
  if (!Array.isArray(rawQuestions)) {
    err('"questions" must be a list.');
    return refused();
  }
  if (rawQuestions.length > LIMITS.questions) {
    err(`There are ${rawQuestions.length} questions; the most in one file is ${LIMITS.questions}. Split it in parts.`);
    return refused();
  }
  const rawMocks = o.mocks === undefined ? [] : o.mocks;
  if (!Array.isArray(rawMocks)) {
    err('"mocks" must be a list.');
    return refused();
  }
  if (rawQuestions.length === 0 && rawMocks.length === 0) {
    err('The file has no "questions" and no "mocks", so there is nothing to import.');
    return refused();
  }
  if (rawMocks.length > LIMITS.mocks) err(`There are ${rawMocks.length} mocks; the most is ${LIMITS.mocks}.`);

  // ----- questions -----
  const questions: FileQuestion[] = [];
  const byRef = new Map<string, FileQuestion>();
  const merged: Record<string, string> = {};
  const seen = new Map<string, FileQuestion>(); // hash → the copy kept
  let dropped = 0;
  rawQuestions.forEach((raw, i) => {
    let w = `questions[${i}]`;
    if (!isObj(raw)) return err(`${w} must be an object.`);
    let ref: string | null = null;
    if (raw.id !== undefined && raw.id !== null && raw.id !== "") {
      if (typeof raw.id !== "string" && typeof raw.id !== "number") return err(`${w}.id must be text.`);
      ref = String(raw.id).trim();
      w = `questions[${i}] ("${ref}")`;
      if (byRef.has(ref) || ref in merged) return err(`${w}: this "id" is used by an earlier question too.`);
    }
    const type = String(raw.type ?? "").toLowerCase() as QuestionType;
    if (!QUESTION_TYPES.includes(type)) return err(`${w}.type must be one of: ${QUESTION_TYPES.join(", ")}.`);
    const req = (key: "subject" | "topic" | "text", max: number): string | null => {
      const v = raw[key];
      if (typeof v !== "string" || !v.trim()) {
        err(`${w} needs a "${key}".`);
        return null;
      }
      if (v.trim().length > max) {
        err(`${w}.${key} is longer than ${max} characters.`);
        return null;
      }
      return clean(v);
    };
    const subject = req("subject", LIMITS.subject);
    const topic = req("topic", LIMITS.topic);
    const stem = req("text", LIMITS.text);
    if (subject === null || topic === null || stem === null) return;

    const difficulty = String(raw.difficulty ?? "medium").toLowerCase() as Difficulty;
    if (!DIFFICULTIES.includes(difficulty))
      return err(`${w}.difficulty "${String(raw.difficulty)}" must be one of: ${DIFFICULTIES.join(", ")}.`);
    const marks = raw.marks === undefined ? 1 : raw.marks;
    if (typeof marks !== "number" || !isFinite(marks) || marks <= 0 || marks > 100)
      return err(`${w}.marks must be a number above 0 (and at most 100).`);
    const negative = raw.negative_marks === undefined ? 0 : raw.negative_marks;
    if (typeof negative !== "number" || !isFinite(negative) || negative < 0 || negative > 100)
      return err(`${w}.negative_marks must be a number, 0 or more (0 = no negative marking).`);
    const pool = String(raw.pool ?? "practice").toLowerCase() as QuestionPool;
    if (!POOLS.includes(pool)) return err(`${w}.pool must be "practice" or "mock".`);

    let explanation: string | null = null;
    if (raw.explanation !== undefined && raw.explanation !== null && raw.explanation !== "") {
      if (typeof raw.explanation !== "string") return err(`${w}.explanation must be text.`);
      if (raw.explanation.trim().length > LIMITS.explanation)
        return err(`${w}.explanation is longer than ${LIMITS.explanation} characters.`);
      explanation = clean(raw.explanation) || null;
    }
    let tags: string[] = [];
    if (raw.tags !== undefined) {
      if (
        !Array.isArray(raw.tags) ||
        raw.tags.some((t) => typeof t !== "string" || !t.trim() || t.trim().length > LIMITS.tag)
      )
        return err(`${w}.tags must be a list of short texts (at most ${LIMITS.tag} characters each).`);
      if (raw.tags.length > LIMITS.tags) return err(`${w} has ${raw.tags.length} tags; the most is ${LIMITS.tags}.`);
      tags = [...new Set((raw.tags as string[]).map((t) => t.trim()))];
    }

    const base: Base = {
      ref,
      subject,
      topic,
      pool,
      difficulty,
      marks,
      negative_marks: negative,
      stem,
      explanation,
      tags,
    };
    let q: FileQuestion;

    if (type === "mcq" || type === "msq") {
      const opts = raw.options;
      if (
        !Array.isArray(opts) ||
        opts.length < LIMITS.minOptions ||
        opts.length > LIMITS.maxOptions ||
        opts.some((x) => typeof x !== "string" || !x.trim())
      )
        return err(`${w}.options must be a list of ${LIMITS.minOptions} to ${LIMITS.maxOptions} non-empty texts.`);
      if ((opts as string[]).some((x) => x.trim().length > LIMITS.option))
        return err(`${w}: an option is longer than ${LIMITS.option} characters.`);
      const options = (opts as string[]).map(clean);
      const last = String.fromCharCode(64 + options.length);
      if (type === "mcq") {
        const a = choiceIndex(raw.answer);
        if (a === null || a >= options.length)
          return err(`${w}.answer must be ONE letter from A to ${last} (this question has ${options.length} options).`);
        q = { ...base, type, options, correct: a };
      } else {
        const list = Array.isArray(raw.answer) ? (raw.answer as unknown[]).map(choiceIndex) : [];
        if (list.length === 0 || list.some((a) => a === null || a >= options.length))
          return err(`${w}.answer must be a list of letters from A to ${last}, e.g. ["A", "C"].`);
        if (new Set(list).size !== list.length) return err(`${w}.answer lists the same option twice.`);
        q = { ...base, type, options, correct: (list as number[]).sort((a, b) => a - b) };
      }
    } else if (type === "nat") {
      if (typeof raw.answer !== "number" || !isFinite(raw.answer))
        return err(`${w}.answer must be a number (not text), e.g. "answer": 3.5.`);
      const tolerance = raw.tolerance === undefined ? 0 : raw.tolerance;
      if (typeof tolerance !== "number" || !isFinite(tolerance) || tolerance < 0)
        return err(`${w}.tolerance must be a number, 0 or more (0 = exact).`);
      q = { ...base, type, value: raw.answer, tolerance };
    } else if (type === "str") {
      const list = typeof raw.answer === "string" ? [raw.answer] : raw.answer;
      if (!Array.isArray(list) || list.length === 0 || list.some((x) => typeof x !== "string" || !x.trim()))
        return err(`${w}.answer must be a text, or a list of accepted texts.`);
      if (list.length > LIMITS.accepted || (list as string[]).some((x) => x.trim().length > LIMITS.acceptedText))
        return err(`${w}.answer has too many accepted answers (${LIMITS.accepted}) or one that is too long.`);
      const match = String(raw.match ?? "exact").toLowerCase() as StrMatch;
      if (!STR_MATCHES.includes(match)) return err(`${w}.match must be one of: ${STR_MATCHES.join(", ")}.`);
      if (raw.case_sensitive !== undefined && typeof raw.case_sensitive !== "boolean")
        return err(`${w}.case_sensitive must be true or false.`);
      q = {
        ...base,
        type,
        match,
        case_sensitive: raw.case_sensitive === true,
        accepted: (list as string[]).map(clean),
      };
    } else {
      let starter: string | null = null;
      if (raw.starter !== undefined && raw.starter !== null && raw.starter !== "") {
        if (typeof raw.starter !== "string") return err(`${w}.starter must be text.`);
        if (raw.starter.length > LIMITS.starter)
          return err(`${w}.starter is longer than ${LIMITS.starter} characters.`);
        starter = raw.starter.replace(/\r\n/g, "\n"); // code keeps its own layout: no trimming
      }
      q = { ...base, type, starter };
    }

    const hash = questionHash(q);
    const same = seen.get(hash);
    if (same) {
      dropped++;
      if (ref) merged[ref] = same.ref ?? ref;
      if (ref && !same.ref) {
        same.ref = ref; // let mocks that name this copy find the one kept
        byRef.set(ref, same);
      }
      return;
    }
    seen.set(hash, q);
    questions.push(q);
    if (ref) byRef.set(ref, q);
  });
  if (dropped) warnings.push(`${dropped} question(s) repeat another one in this file, so only one copy is kept.`);
  if (questions.some((q) => /img:/.test(q.stem + (q.explanation ?? ""))))
    warnings.push("Some questions mention pictures (img:…). Pictures can't come in a file yet, so they won't show.");

  // ----- mocks -----
  const mocks: FileMock[] = [];
  const used = new Set<string>();
  rawMocks.forEach((m, i) => {
    const w = `mocks[${i}]`;
    if (!isObj(m) || typeof m.name !== "string" || !m.name.trim()) return err(`${w} needs a "name".`);
    if (m.name.trim().length > LIMITS.mockName) return err(`${w}.name is longer than ${LIMITS.mockName} characters.`);
    const minutes = m.minutes;
    if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 1 || minutes > LIMITS.minutes)
      return err(`${w}.minutes must be a whole number from 1 to ${LIMITS.minutes} (the whole test's time limit).`);
    if (m.full_screen !== undefined && typeof m.full_screen !== "boolean")
      return err(`${w}.full_screen must be true or false.`);
    let instructions: string | null = null;
    if (m.instructions !== undefined && m.instructions !== null && m.instructions !== "") {
      if (typeof m.instructions !== "string" || m.instructions.trim().length > LIMITS.instructions)
        return err(`${w}.instructions must be text of at most ${LIMITS.instructions} characters.`);
      instructions = clean(m.instructions) || null;
    }
    if (!Array.isArray(m.sections) || m.sections.length === 0 || m.sections.length > LIMITS.sections)
      return err(`${w}.sections must be a list of 1 to ${LIMITS.sections} sections.`);
    const inMock = new Set<FileQuestion>();
    const sections: FileMockSection[] = [];
    let bad = false;
    (m.sections as unknown[]).forEach((s, k) => {
      const sw = `${w}.sections[${k}]`;
      if (!isObj(s) || typeof s.name !== "string" || !s.name.trim()) {
        bad = true;
        return err(`${sw} needs a "name".`);
      }
      let sMinutes: number | null = null;
      if (s.minutes !== undefined && s.minutes !== null) {
        if (typeof s.minutes !== "number" || !Number.isInteger(s.minutes) || s.minutes < 1 || s.minutes > minutes) {
          bad = true;
          return err(`${sw}.minutes must be a whole number from 1 up to the mock's ${minutes} minutes.`);
        }
        sMinutes = s.minutes;
      }
      if (
        !Array.isArray(s.questions) ||
        s.questions.length === 0 ||
        s.questions.some((r) => typeof r !== "string" && typeof r !== "number")
      ) {
        bad = true;
        return err(`${sw}.questions must be a list of question ids from this file.`);
      }
      const refs: string[] = [];
      for (const r0 of s.questions as (string | number)[]) {
        const r = String(r0).trim();
        const q = byRef.get(merged[r] ?? r);
        if (!q) {
          bad = true;
          return err(`${sw} uses the question id "${r}", which isn't in "questions".`);
        }
        if (inMock.has(q)) {
          bad = true;
          return err(`${sw}: question "${r}" is already in this mock (once per mock).`);
        }
        inMock.add(q);
        used.add(q.ref!);
        refs.push(q.ref!);
      }
      sections.push({ name: clean(s.name).slice(0, LIMITS.mockName), minutes: sMinutes, questions: refs });
    });
    if (bad) return;
    mocks.push({
      name: clean(m.name),
      instructions,
      minutes,
      full_screen: m.full_screen === true,
      sections,
    });
  });
  const strays = questions.filter((q) => q.pool === "mock" && !(q.ref && used.has(q.ref))).length;
  if (strays)
    warnings.push(`${strays} question(s) are marked "mock" but no mock in this file uses them. They are still saved.`);

  if (fixedSlashes) warnings.push(`${fixedSlashes} maths backslash(es) were broken by JSON and have been put back.`);
  if (errors.length) return refused();
  return { file: { name, questions, mocks, merged }, errors, warnings };
}

/** Counts for the preview, in the Practice tabs' own terms. */
export function questionSummary(f: QuestionFile) {
  const subjects = new Set(f.questions.map((q) => q.subject.toLowerCase()));
  const topics = new Set(f.questions.map((q) => `${q.subject.toLowerCase()}\n${q.topic.toLowerCase()}`));
  return {
    practice: f.questions.filter((q) => q.pool === "practice" && q.type !== "code").length,
    programming: f.questions.filter((q) => q.pool === "practice" && q.type === "code").length,
    mockQuestions: f.questions.filter((q) => q.pool === "mock").length,
    mocks: f.mocks.length,
    subjects: subjects.size,
    topics: topics.size,
  };
}
