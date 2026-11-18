// Table `question_stats`: running totals per question (progress, not content).
// A summary of question_answers: every field can be rebuilt by counting that table.
// A question with no row has never been shown.
// Skipped = visited − correct − incorrect.
// PRIMARY KEY (question_id): one row per question.

import type { QuestionId } from "@/types/tables/common";

export interface QuestionStatRow {
  question_id: QuestionId; // PRIMARY KEY → questions.id
  visited: number; // sittings the question was shown in (= its question_answers rows)
  correct: number; // times answered right
  incorrect: number; // times answered wrong
}
