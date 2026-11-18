// Table `plan_question_ticks`: linked questions that got done (state). No row = not done.
// Written automatically, never by hand: when a question gets a correct or incorrect answer
// (question_answers row; skipped doesn't count), every not-yet-ticked link to that question
// on a day up to and including today is ticked. Days in the future are not ticked early.
// PRIMARY KEY (day_id, question_id): matches plan_day_questions.

import type { PlanDayId, QuestionId } from "@/types/tables/common";

export interface PlanQuestionTickRow {
  day_id: PlanDayId; // → plan_day_questions (deleting the link deletes the tick)
  question_id: QuestionId;
  answer_id: number; // → question_answers.id: the answer that ticked it (correct or not)
  done_at: number; // = that answer's recorded_at
}
