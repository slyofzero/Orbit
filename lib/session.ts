// The rules of a practice sitting, as pure functions: where to start, what the question palette shows, what is
// written to `question_answers` when it ends, and the summary. No clock and no database.

import type { Verdict } from "@/lib/grade";
import type { AnswerOutcome } from "@/types/tables";

/** The colour of one number in the question palette (components/question/QuestionPalette.tsx). */
export type PaletteState = "new" | "seen" | "right" | "wrong";

/** Where a sitting opens: the first question you have never tried, else the first one. */
export function startIndex(items: { latest: "correct" | "incorrect" | null }[]): number {
  const i = items.findIndex((x) => x.latest === null);
  return i < 0 ? 0 : i;
}

/** A checked answer as the outcome to store. Nothing answered counts as skipped. */
export const outcomeOf = (v: Verdict): AnswerOutcome => v ?? "skipped";

/** What the palette shows for a question this sitting: its result once answered, "seen" once opened. */
export function paletteState(outcome: AnswerOutcome | undefined, visited: boolean): PaletteState {
  if (outcome === "correct") return "right";
  if (outcome === "incorrect") return "wrong";
  return visited ? "seen" : "new";
}

/** Questions shown but never answered (and not written yet): each is stored as `skipped` when the sitting ends,
 *  so its time isn't lost. In the order they were opened. */
export function pendingSkips(visited: Iterable<string>, written: ReadonlySet<string>): string[] {
  return [...visited].filter((id) => !written.has(id));
}

/** How long a right answer stays on screen before the sitting moves on by itself. */
export const AUTO_NEXT_MS = 1000;

/** Where a sitting moves by itself after an answer: the next question when it was right (and there is one), else
 *  nowhere (null): a wrong answer stays on screen so you can read the explanation or Try again. */
export function autoNext(outcome: AnswerOutcome, index: number, total: number): number | null {
  return outcome === "correct" && index + 1 < total ? index + 1 : null;
}

export interface SessionSummary {
  total: number; // questions in the sitting
  answered: number; // right + wrong
  right: number;
  wrong: number;
  unanswered: number;
  accuracy: number | null; // percent of answered that are right; null = nothing answered
}

/** The end-of-sitting numbers from the outcomes recorded this sitting (question id → outcome). */
export function summarize(outcomes: Record<string, AnswerOutcome>, total: number): SessionSummary {
  const all = Object.values(outcomes);
  const right = all.filter((o) => o === "correct").length;
  const wrong = all.filter((o) => o === "incorrect").length;
  const answered = right + wrong;
  return {
    total,
    answered,
    right,
    wrong,
    unanswered: Math.max(0, total - answered),
    accuracy: answered ? Math.round((right / answered) * 100) : null,
  };
}
