// Table `mock_attempts`: one row per time the user takes a mock (state).
// The test's layout is copied in at the start (sections here, questions in
// mock_attempt_items), so editing the mock later never changes a past attempt.
// Question text is NOT copied: editing a question changes how old reviews show it.
// Only `submitted` attempts are scored and write question_answers rows (docs/STATS.md).
// PRIMARY KEY (id). Listed by (mock_id, started_at).

import type { AttemptId, AttemptStatus, MockId } from "@/types/tables/common";

export interface MockAttemptRow {
  id: AttemptId; // PRIMARY KEY
  mock_id: MockId; // → mocks.id (mocks are retired, never deleted, so this always resolves)
  status: AttemptStatus; // in_progress | submitted | abandoned | failed
  sections: { name: string; minutes: number | null }[]; // copied from mock_sections at start;
  // mock_attempt_items.section is an index into this
  minutes: number; // copied from mocks.minutes at start
  started_at: number;
  ended_at: number | null; // submitted, abandoned or failed; null while in progress
  current: number; // index of the question on screen (into the attempt's item order); resumes here
  warnings: number; // times full screen was left (only for mocks with full_screen)
  failed_reason: string | null; // set only when status = failed
  score: number | null; // total marks, negative marking included; set at submit
  max_score: number | null; // sum of marks of every question; set at submit
}
