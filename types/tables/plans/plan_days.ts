// Table `plan_days`: one row per date that has something planned (content).
// What is on the day lives in plan_tasks and plan_day_questions; how much of it got done
// lives in plan_day_progress.
// PRIMARY KEY (id). UNIQUE (plan_id, on_date): one row per date per plan.

import type { IsoDate, PlanDayId, PlanId } from "@/types/tables/common";

export interface PlanDayRow {
  id: PlanDayId; // PRIMARY KEY; tasks, linked questions and progress refer to this
  plan_id: PlanId; // → plans.id (deleting the plan deletes its days)
  on_date: IsoDate; // between plans.starts_on and plans.ends_on
  title: string | null; // short heading for the day, e.g. "Eigenvalues"
  note: string | null; // longer guidance for the day
}
