// Table `question_answers`: one row per question per sitting (progress, not content).
// A sitting = one practice session or one mock attempt. The row is written when the
// question is answered, or when the sitting ends with the question left unanswered.
// Coming back to the same question in a later sitting makes a new row.
// How these rows become stats: docs/STATS.md.
// Mock answers are written only when the attempt is submitted.
// PRIMARY KEY (id). Indexed by (question_id, recorded_at) and (attempt_id).

import type { AnswerOutcome, AttemptId, QuestionId } from "@/types/tables/common";

export interface QuestionAnswerRow {
  id: number; // PRIMARY KEY
  question_id: QuestionId; // → questions.id
  recorded_at: number; // when it was answered, or when the sitting ended (skipped)
  outcome: AnswerOutcome; // correct | incorrect | skipped
  time_ms: number; // ACTIVE time on this question, summed over all visits in the
  // sitting; paused when the tab is hidden or the user is idle
  attempt_id: AttemptId | null; // → mock_attempts.id for a mock answer; null = practice
}
