// Table `question_code`: one row per code (write-a-program) question.
// For now just the question text (in questions.stem) plus optional starter code.
// PRIMARY KEY (question_id): one row per question.

import type { QuestionId } from "./common";

export interface QuestionCodeRow {
  question_id: QuestionId; // PRIMARY KEY → questions.id
  starter: string | null; // code the editor opens with; null = empty editor
}
