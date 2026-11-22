// Table `plan_tasks`: the to-do items of a day (content). Ticking one off is state, in
// plan_task_ticks, so editing, adding or reordering tasks never loses a tick.
// PRIMARY KEY (id). Listed by (day_id, position).

import type { PlanDayId, PlanTaskId } from "@/types/tables/common";

export interface PlanTaskRow {
  id: PlanTaskId; // PRIMARY KEY
  day_id: PlanDayId; // → plan_days.id
  position: number; // REAL: inserting between 1 and 2 uses 1.5, nothing is renumbered
  body: string; // the task, markdown + LaTeX
}
