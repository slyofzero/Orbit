// Table `plan_task_ticks`: tasks the user ticked off (state). No row = not done.
// Unticking deletes the row.
// PRIMARY KEY (task_id): a task is either done or not.

import type { PlanTaskId } from "@/types/tables/common";

export interface PlanTaskTickRow {
  task_id: PlanTaskId; // PRIMARY KEY → plan_tasks.id (deleting the task deletes the tick)
  done_at: number; // when it was ticked; later than the day's date = done late
}
