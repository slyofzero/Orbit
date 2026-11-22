// Table `plan_day_progress`: how much of each day got done (state, summary cache).
// One row per plan_days row. Every field can be rebuilt by counting plan_tasks,
// plan_day_questions and the two tick tables, and is updated in the same transaction
// as any change to them. It makes the calendar, the history and the streak one
// indexed read instead of four joins.
//
// status (derived from the counts, never set by hand):
//   total = tasks_total + questions_total
//   done  = tasks_done + questions_done
//   total = 0      → null        (nothing planned: a rest day)
//   done  = total  → "done"
//   done  > 0      → "partial"
//   done  = 0      → "incomplete"
// A day in the future has a status too (usually "incomplete"); the UI shows it as
// "upcoming" by comparing on_date with today. That is a date check, not stored.
//
// Streaks are NOT stored: "current streak" changes at midnight without any write, so a
// stored number would go stale. Rule (docs/PLANS.md): walk back from today over this
// table; "done" days add 1, rest days (no row, or status null) are skipped, anything else
// ends the streak. Today only counts once it is "done", and doesn't end the streak before.
// PRIMARY KEY (day_id). Indexed by (plan_id, on_date).

import type { IsoDate, PlanDayId, PlanDayStatus, PlanId } from "@/types/tables/common";

export interface PlanDayProgressRow {
  day_id: PlanDayId; // PRIMARY KEY → plan_days.id
  plan_id: PlanId; // copied from plan_days so one index serves a whole plan's calendar
  on_date: IsoDate; // copied from plan_days, same reason
  tasks_total: number; // rows in plan_tasks for the day
  tasks_done: number; // of those, rows in plan_task_ticks
  questions_total: number; // rows in plan_day_questions for the day
  questions_done: number; // of those, rows in plan_question_ticks
  status: PlanDayStatus | null; // generated from the counts (rule above)
  done_at: number | null; // when the day last became "done"; null while not done
}
