// Table `plan_day_questions`: questions linked to a day, to be answered that day (content).
// The day's question target IS the number of rows here; there is no separate count.
// Whether each one got done is state, in plan_question_ticks.
// PRIMARY KEY (day_id, question_id): the same question can't be linked twice to one day
// (it can be linked to other days).

import type { PlanDayId, QuestionId } from "@/types/tables/common";

export interface PlanDayQuestionRow {
  day_id: PlanDayId; // → plan_days.id
  question_id: QuestionId; // → questions.id
  position: number; // REAL, same as plan_tasks.position
}
