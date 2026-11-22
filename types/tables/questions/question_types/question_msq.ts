// Table `question_msq`: one row per msq (one or more correct choices) question.
// PRIMARY KEY (question_id): one row per question.

import type { QuestionId } from "@/types/tables/common";

export interface QuestionMsqRow {
  question_id: QuestionId; // PRIMARY KEY → questions.id
  options: string[]; // the choices; array index = position (0 = A)
  correct: number[]; // indexes into options, at least one, no repeats
}
