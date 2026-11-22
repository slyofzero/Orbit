// Table `plan_bonus`: bonus work (content, docs/PLANS.md §5). When a day closes, each item still pending (a task,
// or a linked question) is placed on one of the next 3 planned days, once. The item stays on its own day
// (from_day_id); doing it ticks it there. A bonus row never counts toward the day it sits on. The user can move it
// to another later day or remove it (Edit plan, or a JSON patch); exporting the plan writes it out.
// PRIMARY KEY (id). Exactly one of task_id / question_id is set. UNIQUE (task_id), UNIQUE (from_day_id, question_id).

import type { PlanDayId, PlanTaskId, QuestionId } from "@/types/tables/common";

export interface PlanBonusRow {
  id: number; // PRIMARY KEY
  day_id: PlanDayId; // → plan_days.id, the day it sits on; later than from_day_id, same plan
  position: number; // REAL, order on that day
  from_day_id: PlanDayId; // → plan_days.id, the item's own day
  task_id: PlanTaskId | null; // → plan_tasks.id (a task of from_day_id), or
  question_id: QuestionId | null; // with from_day_id → plan_day_questions (a linked question)
}
