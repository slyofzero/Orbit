// Types for questions loaded with their type-specific row, as the `question.*` queries return them.

import type {
  QuestionCodeRow,
  QuestionMcqRow,
  QuestionMsqRow,
  QuestionNatRow,
  QuestionRow,
  QuestionStrRow,
} from "@/types/tables";

/** The row of the type table that matches `question.type`. */
export type QuestionDetail = QuestionMcqRow | QuestionMsqRow | QuestionNatRow | QuestionStrRow | QuestionCodeRow;

/** One question ready to show: the question, its type row, and how you last did on it. */
export interface LoadedQuestion {
  question: QuestionRow;
  detail: QuestionDetail;
  latest: "correct" | "incorrect" | null; // latest counted answer (skips ignored); null = never tried
}

/** `question.topic`: the practice questions of one topic, in a fixed order (it never changes while you answer). */
export interface TopicQuestions {
  topic: { id: string; name: string; subject_name: string } | null; // null = no such topic
  items: LoadedQuestion[];
}
