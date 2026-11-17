// Table `question_tags`: which tags a question has (any type).
// PRIMARY KEY (question_id, tag_id): a question can't have the same tag twice.

import type { QuestionId, RowId } from "./common";

export interface QuestionTagRow {
  question_id: QuestionId; // → questions.id
  tag_id: RowId; // → tags.id
}
