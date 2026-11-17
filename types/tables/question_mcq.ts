// Table `question_mcq`: one row per mcq (single correct choice) question.
// PRIMARY KEY (question_id): one row per question.

import type { QuestionId } from "./common";

export interface QuestionMcqRow {
  question_id: QuestionId; // PRIMARY KEY → questions.id
  options: string[]; // the choices; array index = position (0 = A)
  correct: number; // index into options: exactly one correct choice
}
