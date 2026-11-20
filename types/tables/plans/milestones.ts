// Table `milestones`: the dates a plan counts down to, e.g. an exam or a quiz (content).
// The dashboard's runway counts down to the next one; the calendar tags their dates.
// PRIMARY KEY (id). Listed by (plan_id, on_date).

import type { IsoDate, PlanId } from "@/types/tables/common";

export interface MilestoneRow {
  id: number; // PRIMARY KEY
  plan_id: PlanId; // → plans.id (deleting the plan deletes its milestones)
  name: string; // e.g. "Quiz 2"
  short: string | null; // shorter label for small spaces (calendar tag); null = use name
  on_date: IsoDate;
  note: string | null; // e.g. "Shaky topics, then stats"
}
