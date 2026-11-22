// The plan tables. Content = what the plan says; state = what the user did.
//
//   plans ──< plan_days ──┬─< plan_tasks ──── plan_task_ticks          (state: 0/1 per task)
//                         ├─< plan_day_questions >── questions
//                         │        └──────── plan_question_ticks       (state: 0/1 per link)
//                         ├─< plan_bonus (an earlier day's task or link, carried over onto this day)
//                         └── plan_day_progress                        (state: counts + status per day)
//   plans ──< milestones                                                (dates the plan counts down to)
//
// Streaks are derived from these tables, never stored. Carry-over is written once per closed day as plan_bonus
// rows, which the user can move or remove. Rules: docs/PLANS.md.

export type { PlanRow } from "@/types/tables/plans/plans";
export type { PlanDayRow } from "@/types/tables/plans/plan_days";
export type { PlanTaskRow } from "@/types/tables/plans/plan_tasks";
export type { PlanDayQuestionRow } from "@/types/tables/plans/plan_day_questions";
export type { PlanTaskTickRow } from "@/types/tables/plans/plan_task_ticks";
export type { PlanQuestionTickRow } from "@/types/tables/plans/plan_question_ticks";
export type { PlanDayProgressRow } from "@/types/tables/plans/plan_day_progress";
export type { PlanBonusRow } from "@/types/tables/plans/plan_bonus";
export type { MilestoneRow } from "@/types/tables/plans/milestones";
