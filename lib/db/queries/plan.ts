// Plan: import a plan file, tick days and tasks.
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.

import { setDayBonus, writeCarry } from "@/lib/db/queries/carry";
import { write } from "@/lib/db/queries/core";
import type { IsoDate } from "@/lib/dates";
import { parsePlanFile } from "@/lib/planFile";

export const planQueries = {
  /** Imports a plan file (lib/planFile.ts) and makes it the active plan. The file is checked again here,
   *  so nothing unchecked is ever saved; on any error nothing is written. Question ids that aren't in the
   *  bank yet are skipped (and counted). */
  "plan.import": write(
    ["plans", "plan_days", "plan_tasks", "plan_day_questions", "plan_bonus", "milestones"],
    (sql, p: { text: string }) => {
      const r = parsePlanFile(p.text);
      if (!r.plan) return { ok: false as const, errors: r.errors, warnings: r.warnings };
      const plan = r.plan;
      const now = Date.now();
      const id = `pl_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      sql.run("UPDATE plans SET is_active = 0 WHERE is_active = 1");
      sql.run(
        `INSERT INTO plans (id, name, description, starts_on, ends_on, is_active, created_at, updated_at,
           original_milestones, carried_before)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        [
          id,
          plan.name,
          plan.description,
          plan.starts_on,
          plan.ends_on,
          now,
          now,
          JSON.stringify(plan.milestones),
          plan.carried_before,
        ],
      );
      let tasks = 0;
      let links = 0;
      let skipped = 0;
      const dayIds = new Map<string, number>();
      for (const d of plan.days) {
        const dayId = sql.get<{ id: number }>(
          "INSERT INTO plan_days (plan_id, on_date, title, note, kind, hours) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
          [id, d.date, d.title, d.note, d.kind, d.hours],
        )!.id;
        dayIds.set(d.date, dayId);
        d.tasks.forEach((body, k) => {
          sql.run("INSERT INTO plan_tasks (day_id, position, body) VALUES (?, ?, ?)", [dayId, k + 1, body]);
          tasks++;
        });
        d.questions.forEach((ref, k) => {
          const q = sql.get<{ id: string }>("SELECT id FROM questions WHERE id = ? OR legacy_id = ? LIMIT 1", [
            ref,
            ref,
          ]);
          if (!q) return void skipped++;
          sql.run("INSERT OR IGNORE INTO plan_day_questions (day_id, question_id, position) VALUES (?, ?, ?)", [
            dayId,
            q.id,
            k + 1,
          ]);
          links++;
        });
      }
      // bonus work, once every day and its items exist (an entry points at an earlier day's task or link)
      let bonus = 0;
      let bonusMissing = 0;
      for (const d of plan.days)
        if (d.bonus.length) {
          const r = setDayBonus(sql, id, dayIds.get(d.date)!, d.bonus, null);
          bonus += r.placed;
          bonusMissing += r.missing.length;
        }
      for (const m of plan.milestones)
        sql.run("INSERT INTO milestones (plan_id, name, short, on_date, note) VALUES (?, ?, ?, ?, ?)", [
          id,
          m.name,
          m.short,
          m.date,
          m.note,
        ]);
      const warnings = [...r.warnings];
      if (skipped)
        warnings.push(
          `${skipped} linked question(s) aren't in your question bank yet, so they were left out. Load your question pack first to keep them.`,
        );
      if (bonusMissing)
        warnings.push(
          `${bonusMissing} bonus item(s) were left out: their "from" day has no such task or linked question.`,
        );
      return {
        ok: true as const,
        planId: id,
        name: plan.name,
        days: plan.days.length,
        tasks,
        links,
        bonus,
        milestones: plan.milestones.length,
        warnings,
      };
    },
  ),

  /** Carry-over (docs/PLANS.md §5): places the unfinished work of every day that closed since the last run as bonus
   *  work on the next 3 planned days (lib/db/queries/carry.ts writeCarry). AppFrame runs it when the app opens and
   *  when the date changes; a second run the same day does nothing. */
  "plan.carry": write(["plans", "plan_bonus"], (sql, p: { today: IsoDate }) => writeCarry(sql, p.today)),

  /** Ticks or unticks every task of one day (v1's "Tick all" / "Untick all"), in one transaction. */
  "plan.tickDay": write(["plan_task_ticks"], (sql, p: { dayId: number; done: boolean }) => {
    if (p.done)
      sql.run(
        `INSERT INTO plan_task_ticks (task_id, done_at) SELECT t.id, ? FROM plan_tasks t
         WHERE t.day_id = ? AND NOT EXISTS (SELECT 1 FROM plan_task_ticks k WHERE k.task_id = t.id)`,
        [Date.now(), p.dayId],
      );
    else
      sql.run("DELETE FROM plan_task_ticks WHERE task_id IN (SELECT id FROM plan_tasks WHERE day_id = ?)", [p.dayId]);
    return p.done;
  }),

  /** Ticks or unticks one plan task. Ticking works on any day, even a locked one (v1: the lock only stops
   *  editing). The triggers in db/schema.sql update the day's plan_day_progress in the same transaction. */
  "plan.tickTask": write(["plan_task_ticks"], (sql, p: { taskId: number; done: boolean }) => {
    if (p.done)
      sql.run(
        `INSERT INTO plan_task_ticks (task_id, done_at) SELECT id, ? FROM plan_tasks
         WHERE id = ? AND NOT EXISTS (SELECT 1 FROM plan_task_ticks WHERE task_id = ?)`,
        [Date.now(), p.taskId, p.taskId],
      );
    else sql.run("DELETE FROM plan_task_ticks WHERE task_id = ?", [p.taskId]);
    return p.done;
  }),
};
