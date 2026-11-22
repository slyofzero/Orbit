// Table `mock_attempt_items`: one row per question in an attempt (state).
// Holds what the exam screen needs: the response, the question palette (visited / marked
// for review) and the question's clock. Rows are created for every question when the
// attempt starts, so a refresh resumes exactly where the user was.
//
// Palette status (derived, not stored):
//   !visited                       → not visited
//   visited, no response, !marked  → not answered
//   response, !marked              → answered
//   no response, marked            → marked for review
//   response, marked               → answered and marked (counts as answered at submit)
//
// At submit, each visited row becomes one question_answers row (attempt_id set) with its
// outcome and time_ms; unvisited questions write nothing. The outcome is stored only
// there; this table keeps the response and the marks it earned for the review screen.
// PRIMARY KEY (attempt_id, question_id). UNIQUE (attempt_id, position).

import type { AttemptId, QuestionId } from "@/types/tables/common";

export interface MockAttemptItemRow {
  attempt_id: AttemptId; // → mock_attempts.id (deleting the attempt deletes its items)
  question_id: QuestionId; // → questions.id
  section: number; // index into mock_attempts.sections
  position: number; // order across the whole attempt (0, 1, 2…)
  choice: number[] | null; // mcq / msq: indexes into the options picked; null = none
  typed: string | null; // nat / str / code: what was typed; null = nothing
  visited: boolean;
  marked: boolean; // "mark for review"
  time_ms: number; // active time on this question so far (same clock rules as practice)
  marks: number | null; // marks earned, negative marking included; set at submit
}
