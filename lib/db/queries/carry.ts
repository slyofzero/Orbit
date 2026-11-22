// Carry-over (docs/PLANS.md §5), shared by plan.carry, dashboard.day, question.day and the plan's export / import /
// editor. Not queries themselves: readers list CARRY_TABLES in their own read([...]). The split rules are in
// lib/carry.ts.
//
// When a day closes, writeCarry places what was still pending at its end on the next 3 planned days as plan_bonus
// rows (once per day: plans.carried_before). carriedInto reads them back for one day.

import type { Sql } from "@/lib/db/sql";
import { CARRY_DAYS, carriedSlice, pendingAtEnd } from "@/lib/carry";
import type { IsoDate } from "@/lib/dates";
import type { PlanFileBonus } from "@/lib/planFile";

export const CARRY_TABLES = [
  "plan_days",
  "plan_tasks",
  "plan_task_ticks",
  "plan_day_questions",
  "plan_question_ticks",
  "plan_bonus",
] as const;

/** `bonusId` is the plan_bonus row (move / remove it); `id` is the original task or question (tick / answer it). */
export type CarriedTask = { bonusId: number; id: number; body: string; from: IsoDate; done: boolean };
export type CarriedQuestion = { bonusId: number; id: string; from: IsoDate; done: boolean };
export type Carried = { tasks: CarriedTask[]; questions: CarriedQuestion[] };

/** The bonus work sitting on the planned day `date` (plan_bonus), in its order. Done = the original is ticked. */
export function carriedInto(sql: Sql, planId: string, date: IsoDate): Carried {
  const out: Carried = { tasks: [], questions: [] };
  const rows = sql.all<{
    bonusId: number;
    task_id: number | null;
    question_id: string | null;
    body: string | null;
    from: IsoDate;
    done: number;
  }>(
    `SELECT b.id AS bonusId, b.task_id, b.question_id, t.body, f.on_date AS "from",
            CASE WHEN b.task_id IS NOT NULL
                 THEN EXISTS (SELECT 1 FROM plan_task_ticks k WHERE k.task_id = b.task_id)
                 ELSE EXISTS (SELECT 1 FROM plan_question_ticks k
                              WHERE k.day_id = b.from_day_id AND k.question_id = b.question_id) END AS done
     FROM plan_bonus b JOIN plan_days d ON d.id = b.day_id JOIN plan_days f ON f.id = b.from_day_id
     LEFT JOIN plan_tasks t ON t.id = b.task_id
     WHERE d.plan_id = ? AND d.on_date = ? ORDER BY b.position, b.id LIMIT 1200`,
    [planId, date],
  );
  for (const r of rows)
    if (r.task_id !== null)
      out.tasks.push({ bonusId: r.bonusId, id: r.task_id, body: r.body ?? "", from: r.from, done: !!r.done });
    else if (r.question_id !== null)
      out.questions.push({ bonusId: r.bonusId, id: r.question_id, from: r.from, done: !!r.done });
  return out;
}

/** The next free position at the end of a day's bonus list. */
export const nextBonusPosition = (sql: Sql, dayId: number) =>
  sql.get<{ p: number }>("SELECT coalesce(max(position), 0) + 1 AS p FROM plan_bonus WHERE day_id = ?", [dayId])!.p;

/** Places one original item on `dayId` as bonus work, at the end of its list; an item that is bonus work on another
 *  day already is moved there (each item is placed once). Returns false if it is that day's bonus already. */
export function placeBonus(sql: Sql, dayId: number, item: Original): boolean {
  const at =
    "taskId" in item
      ? sql.get<{ id: number; day_id: number }>("SELECT id, day_id FROM plan_bonus WHERE task_id = ?", [item.taskId])
      : sql.get<{ id: number; day_id: number }>(
          "SELECT id, day_id FROM plan_bonus WHERE from_day_id = ? AND question_id = ?",
          [item.fromDayId, item.questionId],
        );
  if (at?.day_id === dayId) return false;
  const position = nextBonusPosition(sql, dayId);
  if (at) sql.run("UPDATE plan_bonus SET day_id = ?, position = ? WHERE id = ?", [dayId, position, at.id]);
  else
    sql.run("INSERT INTO plan_bonus (day_id, position, from_day_id, task_id, question_id) VALUES (?, ?, ?, ?, ?)", [
      dayId,
      position,
      item.fromDayId,
      "taskId" in item ? item.taskId : null,
      "questionId" in item ? item.questionId : null,
    ]);
  return true;
}

type Original = { fromDayId: number; taskId: number } | { fromDayId: number; questionId: string };

/** The item a file's bonus entry means: the task with that text (one not placed yet first, so two same-named tasks
 *  are told apart) or the linked question, on the plan day `from`. null = no such item. */
export function findOriginal(sql: Sql, planId: string, b: PlanFileBonus): Original | null {
  const from = sql.get<{ id: number }>("SELECT id FROM plan_days WHERE plan_id = ? AND on_date = ?", [planId, b.from]);
  if (!from) return null;
  if ("task" in b) {
    const t = sql.get<{ id: number }>(
      `SELECT t.id FROM plan_tasks t WHERE t.day_id = ? AND t.body = ?
       ORDER BY EXISTS (SELECT 1 FROM plan_bonus x WHERE x.task_id = t.id), t.position, t.id LIMIT 1`,
      [from.id, b.task],
    );
    return t ? { fromDayId: from.id, taskId: t.id } : null;
  }
  const ref = sql.get<{ id: string }>(
    `SELECT l.question_id AS id FROM plan_day_questions l JOIN questions q ON q.id = l.question_id
     WHERE l.day_id = ? AND (q.id = ? OR q.legacy_id = ?) LIMIT 1`,
    [from.id, b.question, b.question],
  );
  return ref ? { fromDayId: from.id, questionId: ref.id } : null;
}

/** Makes `entries` the bonus work of one day, in that order: the day's other bonus items are removed, and an entry
 *  that sits on another day is moved here. `before`: entries from that date or later are skipped (only work of a
 *  day that is over can be bonus work). Returns how many were placed and which entries matched nothing. */
export function setDayBonus(
  sql: Sql,
  planId: string,
  dayId: number,
  entries: PlanFileBonus[],
  before: IsoDate | null,
): { placed: number; missing: PlanFileBonus[] } {
  sql.run("DELETE FROM plan_bonus WHERE day_id = ?", [dayId]);
  const missing: PlanFileBonus[] = [];
  let placed = 0;
  for (const b of entries) {
    const o = before !== null && b.from >= before ? null : findOriginal(sql, planId, b);
    if (!o) missing.push(b);
    else if (placeBonus(sql, dayId, o)) placed++;
  }
  return { placed, missing };
}

/** One day's bonus work as plan-file entries (Export plan, the JSON patch prompt). */
export function bonusEntries(sql: Sql, dayId: number): PlanFileBonus[] {
  return sql
    .all<{ from: IsoDate; body: string | null; question_id: string | null }>(
      `SELECT f.on_date AS "from", t.body, b.question_id FROM plan_bonus b JOIN plan_days f ON f.id = b.from_day_id
       LEFT JOIN plan_tasks t ON t.id = b.task_id WHERE b.day_id = ? ORDER BY b.position, b.id LIMIT 1200`,
      [dayId],
    )
    .map(
      (r): PlanFileBonus =>
        r.question_id !== null ? { from: r.from, question: r.question_id } : { from: r.from, task: r.body ?? "" },
    );
}

/** Writes the carry-over of every planned day that has closed since the last run (date before `today`, and on or
 *  after plans.carried_before): its share of what was still pending when it ended goes to each of the next 3
 *  planned days, tasks and questions split separately (lib/carry.ts). Items carry once: only a day's own items, and
 *  an item already placed (or moved) stays where it is. Returns how many items it placed; 0 = nothing to do. */
export function writeCarry(sql: Sql, today: IsoDate): { days: number; placed: number } {
  const plan = sql.get<{ id: string; carried_before: IsoDate | null }>(
    "SELECT id, carried_before FROM plans WHERE is_active = 1",
  );
  if (!plan || (plan.carried_before !== null && plan.carried_before >= today)) return { days: 0, placed: 0 };
  const sources = sql.all<{ id: number; on_date: IsoDate }>(
    `SELECT id, on_date FROM plan_days WHERE plan_id = ? AND on_date < ? AND (? IS NULL OR on_date >= ?)
     ORDER BY on_date LIMIT 2000`,
    [plan.id, today, plan.carried_before, plan.carried_before],
  );
  let placed = 0;
  for (const src of sources) {
    const receivers = sql.all<{ id: number }>(
      `SELECT id FROM plan_days WHERE plan_id = ? AND on_date > ? ORDER BY on_date LIMIT ${CARRY_DAYS}`,
      [plan.id, src.on_date],
    );
    if (!receivers.length) continue;
    const tasks = sql
      .all<{ id: number; done_at: number | null }>(
        `SELECT t.id, k.done_at FROM plan_tasks t LEFT JOIN plan_task_ticks k ON k.task_id = t.id
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
    // an item placed already (an earlier run, an imported file, or the user moved it) stays where it is
    const taskPlaced = (id: number) => !!sql.get("SELECT 1 FROM plan_bonus WHERE task_id = ?", [id]);
    const questionPlaced = (id: string) =>
      !!sql.get("SELECT 1 FROM plan_bonus WHERE from_day_id = ? AND question_id = ?", [src.id, id]);
    receivers.forEach((r, j) => {
      for (const t of carriedSlice(tasks, receivers.length, j))
        if (!taskPlaced(t.id) && placeBonus(sql, r.id, { fromDayId: src.id, taskId: t.id })) placed++;
      for (const q of carriedSlice(questions, receivers.length, j))
        if (!questionPlaced(q.id) && placeBonus(sql, r.id, { fromDayId: src.id, questionId: q.id })) placed++;
    });
  }
  sql.run("UPDATE plans SET carried_before = ? WHERE id = ?", [today, plan.id]);
  return { days: sources.length, placed };
}
