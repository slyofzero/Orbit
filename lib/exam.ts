// The rules of a mock attempt, as pure functions: the palette status of a question, whether something is
// answered, grading a saved response, the score, what is written to `question_answers` at submit, how a short
// test is built from practice questions, the clock and the full-screen warnings. No database and no React.
// Tables: types/tables/mocks/; the stats rules: docs/STATS.md §5.

import { gradeMcq, gradeMsq, gradeNat, gradeStr, marksFor, type Verdict } from "@/lib/grade";
import type { QuestionDetail } from "@/lib/questions";
import type {
  AnswerOutcome,
  MockAttemptItemRow,
  MockAttemptRow,
  QuestionMcqRow,
  QuestionMsqRow,
  QuestionNatRow,
  QuestionRow,
  QuestionStrRow,
} from "@/types/tables";

// ----- what the `mock.*` queries return -----

/** `mock.intro`: what the instructions page shows before an attempt starts. */
export interface MockIntro {
  mock: { id: string; name: string; instructions: string | null; minutes: number; full_screen: boolean } | null;
  sections: { name: string; minutes: number | null; questions: number; marks: number }[];
  questions: number;
  marks: number; // the most you can score (code questions left out)
  code: number; // code questions in it (not scored)
  open: { id: string; name: string } | null; // a test already in progress (only one at a time)
}

/** `mock.attempt`: one attempt with every question, its type row and the saved response. */
export interface AttemptData {
  attempt: MockAttemptRow | null; // null = no such attempt
  mock: { id: string; name: string; instructions: string | null; full_screen: boolean } | null;
  items: { item: MockAttemptItemRow; question: QuestionRow; detail: QuestionDetail }[];
}

/** What a question holds during a mock:options picked (mcq / msq) or text typed (nat / str / code). */
export interface ExamResponse {
  choice: number[] | null;
  typed: string | null;
}
export const NO_RESPONSE: ExamResponse = { choice: null, typed: null };

/** The palette colour of a question in a mock (the real exam's five). */
export type ExamStatus = "not_visited" | "not_answered" | "answered" | "marked" | "answered_marked";
export const EXAM_STATUSES: readonly ExamStatus[] = [
  "not_visited",
  "not_answered",
  "answered",
  "marked",
  "answered_marked",
];

/** True when the response holds an answer (an option picked or something other than spaces typed). */
export function hasResponse(r: ExamResponse): boolean {
  if (r.choice) return r.choice.length > 0;
  return r.typed !== null && r.typed.trim() !== "";
}

/** A response cleaned for saving: empty → nothing, options sorted, typed text trimmed (code kept as written). */
export function cleanResponse(type: QuestionRow["type"], r: ExamResponse): ExamResponse {
  if (type === "mcq" || type === "msq") {
    const c = [...new Set(r.choice ?? [])].sort((a, b) => a - b);
    return { choice: c.length ? (type === "mcq" ? c.slice(0, 1) : c) : null, typed: null };
  }
  if (r.typed === null || r.typed.trim() === "") return NO_RESPONSE;
  return { choice: null, typed: type === "code" ? r.typed : r.typed.trim() };
}

/** The palette status of one question (types/tables/mocks/mock_attempt_items.ts). */
export function examStatus(item: { visited: boolean; marked: boolean } & ExamResponse): ExamStatus {
  if (!item.visited) return "not_visited";
  const answered = hasResponse(item);
  if (item.marked) return answered ? "answered_marked" : "marked";
  return answered ? "answered" : "not_answered";
}

/** How many questions are in each status. */
export function countStatuses(statuses: ExamStatus[]): Record<ExamStatus, number> {
  const out = { not_visited: 0, not_answered: 0, answered: 0, marked: 0, answered_marked: 0 };
  for (const s of statuses) out[s]++;
  return out;
}

/** Code questions can't be checked automatically, so a mock doesn't score them. */
export const isScored = (type: QuestionRow["type"]) => type !== "code";

/** Grades a saved response. `marks` is what it earned (negative marking included); null = not scored (code). */
export function gradeResponse(
  question: Pick<QuestionRow, "type" | "marks" | "negative_marks">,
  detail: QuestionDetail,
  r: ExamResponse,
): { verdict: Verdict; marks: number | null } {
  let verdict: Verdict = null;
  switch (question.type) {
    case "mcq":
      verdict = gradeMcq((detail as QuestionMcqRow).correct, r.choice?.[0] ?? null);
      break;
    case "msq":
      verdict = gradeMsq((detail as QuestionMsqRow).correct, r.choice ?? []);
      break;
    case "nat": {
      const d = detail as QuestionNatRow;
      verdict = gradeNat(d.value, d.tolerance, r.typed ?? "");
      break;
    }
    case "str": {
      const d = detail as QuestionStrRow;
      verdict = gradeStr(d.match, d.case_sensitive, d.accepted, r.typed ?? "");
      break;
    }
    case "code":
      return { verdict: null, marks: null };
  }
  return { verdict, marks: marksFor(verdict, question.marks, question.negative_marks) };
}

/** The outcome stored in `question_answers` for a visited question at submit. Code is stored as skipped. */
export const outcomeOfGrade = (g: { verdict: Verdict; marks: number | null }): AnswerOutcome =>
  g.marks === null ? "skipped" : (g.verdict ?? "skipped");

/** Total and maximum score. Code questions count in neither. */
export function scoreOf(items: { type: QuestionRow["type"]; full: number; marks: number | null }[]): {
  score: number;
  max: number;
} {
  let score = 0;
  let max = 0;
  for (const i of items) {
    if (!isScored(i.type)) continue;
    max += i.full;
    score += i.marks ?? 0;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { score: round(score), max: round(max) };
}

// ----- the clock -----

/** Milliseconds left in an attempt (never below 0). Wall clock: leaving or refreshing doesn't pause it. */
export const timeLeftMs = (startedAt: number, minutes: number, now: number) =>
  Math.max(0, startedAt + minutes * 60_000 - now);

/** "01:59:07" */
export function clockText(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** The timer's colour: amber in the last 10 minutes, red in the last 2. */
export function clockTone(ms: number): "normal" | "low" | "critical" {
  if (ms <= 2 * 60_000) return "critical";
  if (ms <= 10 * 60_000) return "low";
  return "normal";
}

// ----- full screen -----

/** Times a full-screen mock may be left: the first time warns, the next one fails the attempt. */
export const ALLOWED_WARNINGS = 1;
/** After leaving full screen, with the warnings counted so far (this one included): fail the attempt? */
export const failsAfter = (warnings: number) => warnings > ALLOWED_WARNINGS;

// ----- short tests built from practice questions -----

export type BuiltKind = "subject" | "topic" | "weak" | "quick";
export const BUILT_SIZE: Record<BuiltKind, number> = { subject: 20, topic: 10, weak: 20, quick: 15 };
export const BUILT_NAME: Record<BuiltKind, string> = {
  subject: "Subject test",
  topic: "Topic test",
  weak: "Weak-topics test",
  quick: "Quick mixed test",
};

/** Picks a built test's questions: ones never answered first, then the rest, each group shuffled; at most `n`.
 *  The quick test spreads over subjects: it takes from each subject in turn. `random` is injectable for tests. */
export function pickQuestions<T extends { id: string; seen: boolean; subject_id: string }>(
  pool: T[],
  n: number,
  spread: boolean,
  random: () => number = Math.random,
): T[] {
  const shuffle = (a: T[]) => {
    const out = [...a];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const ordered = [...shuffle(pool.filter((q) => !q.seen)), ...shuffle(pool.filter((q) => q.seen))];
  if (!spread) return ordered.slice(0, n);
  const bySubject = new Map<string, T[]>();
  for (const q of ordered) bySubject.set(q.subject_id, [...(bySubject.get(q.subject_id) ?? []), q]);
  const lanes = [...bySubject.values()];
  const out: T[] = [];
  for (let round = 0; out.length < n && lanes.some((l) => l.length > round); round++)
    for (const l of lanes) if (l[round] && out.length < n) out.push(l[round]);
  return out;
}

/** A built test's time: about 1.8 minutes per mark, at least 5 minutes, whole minutes. */
export const builtMinutes = (totalMarks: number) => Math.max(5, Math.ceil(totalMarks * 1.8));
