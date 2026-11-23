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
  lastOutcome?: "correct" | "incorrect" | "skipped" | null; // latest attempt outcome including skipped
  lastAt?: number | null; // recorded_at timestamp of the latest attempt
}

/** `question.code`: one code question for the Programming screen, with its place in the Programming list. */
export interface CodeQuestionData {
  item: LoadedQuestion | null; // null = no such code question (or retired)
  topic: { id: string; name: string; subject_name: string } | null;
  index: number; // 0-based place in the Programming list
  total: number; // code questions in the list
  prev: string | null; // id of the one before it
  next: string | null; // id of the one after it
}

/** `question.topic`:the practice questions of one topic, in a fixed order (it never changes while you answer). */
export interface TopicQuestions {
  topic: { id: string; name: string; subject_name: string } | null; // null = no such topic
  items: LoadedQuestion[];
}

/** `question.day`: one plan day's linked questions, then the bonus ones carried into it (docs/PLANS.md §5).
 *  The topic is the day ("Questions for …", and the plan's name). */
export interface DayQuestions extends TopicQuestions {
  bonus: Record<string, string>; // bonus question id → the IsoDate it was carried from
}
