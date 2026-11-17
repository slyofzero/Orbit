// Table `question_nat`: one row per nat (numerical answer) question.
// PRIMARY KEY (question_id): one row per question.

import type { QuestionId } from "./common";

export interface QuestionNatRow {
  question_id: QuestionId;          // PRIMARY KEY → questions.id
  value: number;
  tolerance: number;                // >= 0; 0 = exact
}
