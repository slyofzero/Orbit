// Carry-over reads (docs/PLANS.md §5), shared by dashboard.day and question.day. Not a query itself: the
// callers list these tables in their own read([...]): plan_days, plan_tasks, plan_task_ticks,
// plan_day_questions, plan_question_ticks. The rules are in lib/carry.ts.

import type { Sql } from "@/lib/db/sql";
import { CARRY_DAYS, carriedSlice, isClosed, pendingAtEnd } from "@/lib/carry";
import type { IsoDate } from "@/lib/dates";

export const CARRY_TABLES = [
  "plan_days",
  "plan_tasks",
  "plan_task_ticks",
  "plan_day_questions",
  "plan_question_ticks",
] as const;

export type CarriedTask = { id: number; body: string; from: IsoDate; done: boolean };
export type CarriedQuestion = { id: string; from: IsoDate; done: boolean };
export type Carried = { tasks: CarriedTask[]; questions: CarriedQuestion[] };

/** The work carried into the planned day `date`: from each closed planned day among the 3 before it, that day's
 *  share of what was still pending when it ended. Oldest source first, each in position order. A rest day (no
 *  plan_days row) gets nothing. Items carry once: only a day's own items, never ones carried into it. */
export function carriedInto(sql: Sql, planId: string, date: IsoDate, today: IsoDate): Carried {
  const out: Carried = { tasks: [], questions: [] };
  if (!sql.get("SELECT 1 FROM plan_days WHERE plan_id = ? AND on_date = ?", [planId, date])) return out;
  const sources = sql.all<{ id: number; on_date: IsoDate }>(
    `SELECT id, on_date FROM plan_days WHERE plan_id = ? AND on_date < ? ORDER BY on_date DESC LIMIT ${CARRY_DAYS}`,
    [planId, date],
  );
  // sources[j] is the planned day j + 1 days before `date`, so `date` gets its chunk j; oldest first
  for (let j = sources.length - 1; j >= 0; j--) {
    const src = sources[j];
    if (!isClosed(src.on_date, today)) continue;
    const slots = sql.get<{ n: number }>(
      `SELECT count(*) AS n FROM (SELECT 1 FROM plan_days WHERE plan_id = ? AND on_date > ? LIMIT ${CARRY_DAYS})`,
      [planId, src.on_date],
    )!.n;
    const tasks = sql
      .all<{ id: number; body: string; done_at: number | null }>(
        `SELECT t.id, t.body, k.done_at FROM plan_tasks t LEFT JOIN plan_task_ticks k ON k.task_id = t.id
         WHERE t.day_id = ? ORDER BY t.position, t.id LIMIT 200`,
        [src.id],
      )
      .filter((t) => pendingAtEnd(t.done_at, src.on_date));
    const questions = sql
      .all<{ id: string; done_at: number | null }>(
        `SELECT l.question_id AS id, k.done_at FROM plan_day_questions l
         LEFT JOIN plan_question_ticks k ON k.day_id = l.day_id AND k.question_id = l.question_id
         WHERE l.day_id = ? ORDER BY l.position, l.question_id LIMIT 1000`,
        [src.id],
      )
      .filter((q) => pendingAtEnd(q.done_at, src.on_date));
    for (const t of carriedSlice(tasks, slots, j))
      out.tasks.push({ id: t.id, body: t.body, from: src.on_date, done: t.done_at !== null });
    for (const q of carriedSlice(questions, slots, j))
      out.questions.push({ id: q.id, from: src.on_date, done: q.done_at !== null });
  }
  return out;
}
