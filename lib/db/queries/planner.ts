// Planner: every day of the active plan with progress.
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.

import { read } from "@/lib/db/queries/core";

import { type IsoDate } from "@/lib/dates";

import type { PlannerDay } from "@/lib/planner";

export const plannerQueries = {
  /** The planner: the active plan and every one of its days with progress counts (null = no plan). */
  "planner.days": read(["plans", "plan_days", "plan_day_progress"], (sql) => {
    const plan = sql.get<{ id: string; name: string; starts_on: IsoDate; ends_on: IsoDate }>(
      "SELECT id, name, starts_on, ends_on FROM plans WHERE is_active = 1",
    );
    if (!plan) return null;
    const days = sql.all<PlannerDay>(
      `SELECT d.on_date, d.title, d.kind, d.hours, p.status,
              coalesce(p.tasks_total, 0) AS tasks_total, coalesce(p.tasks_done, 0) AS tasks_done,
              coalesce(p.questions_total, 0) AS questions_total, coalesce(p.questions_done, 0) AS questions_done
       FROM plan_days d LEFT JOIN plan_day_progress p ON p.day_id = d.id
       WHERE d.plan_id = ? ORDER BY d.on_date LIMIT 2000`,
      [plan.id],
    );
    return { plan, days };
  }),
};
