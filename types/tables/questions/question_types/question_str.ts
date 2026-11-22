// Table `question_str`: one row per str (typed text answer) question.
// PRIMARY KEY (question_id): one row per question.

import type { QuestionId, StrMatch } from "@/types/tables/common";

export interface QuestionStrRow {
  question_id: QuestionId; // PRIMARY KEY → questions.id
  match: StrMatch;
  case_sensitive: boolean;
  accepted: string[]; // accepted answers, at least one; any one is right.
  // for match 'list' / 'set': each is comma-separated items
}
