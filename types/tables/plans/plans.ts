// Table `plans`: one row per study plan (content). A plan runs from starts_on to ends_on.
// Dates inside that range with no plan_days row are rest days: nothing to do, and they
// never break a streak.
// PRIMARY KEY (id). At most one row has is_active = 1.

import type { IsoDate, PlanId } from "@/types/tables/common";

export interface PlanRow {
  id: PlanId; // PRIMARY KEY
  name: string;
  description: string | null; // what the plan is for, in the owner's words; sent with AI prompts
  starts_on: IsoDate; // first day of the plan
  ends_on: IsoDate; // last day; >= starts_on
  is_active: 0 | 1; // the plan the planner shows; only one at a time
  created_at: number;
  updated_at: number;
}
