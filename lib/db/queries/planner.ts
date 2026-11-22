// Planner: every day of the active plan with progress.
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.

import { read } from "@/lib/db/queries/core";

import { type IsoDate } from "@/lib/dates";

import { TASK_WHEN, type PlannerDay, type TaskWhen } from "@/lib/planner";
import type { PlanDayKind } from "@/types/tables";

const MAX_ROWS = 2000;
const KINDS: PlanDayKind[] = ["study", "light", "mock", "crunch", "buffer", "exam", "taper"];

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

  /** Manage plan: one page of the active plan's tasks, a page being `days` plan days (DAY_PAGE, 5) with every
   *  matching task of each, in task order. Filtered by when (from today / before today / all), the day's kind and
   *  `search`: text in the task or the day's title; `range`: only the tasks from `range.from` to `range.to`, and on `range.weekday` only (0 = Monday) when given (a day,
   *  week or month: DateFilter), whatever "when" says. From
   *  today and All run oldest day first; Past runs newest first.
   *  `page` null = the page holding today (All), else the first. Returns the page it settled on, the number of
   *  pages, the range (or null), matching days and tasks, the counts per "when" and
   *  whether any day has linked questions.
   *  null = no plan. */
  "planner.tasks": read(
    ["plans", "plan_days", "plan_tasks", "plan_task_ticks", "plan_day_questions"],
    (
      sql,
      p: {
        search: string;
        when: TaskWhen;
        kind: PlanDayKind | null;
        range?: { from: IsoDate; to: IsoDate; weekday?: number | null } | null;
        today: IsoDate;
        page: number | null;
        days: number;
      },
    ) => {
      if (!TASK_WHEN.includes(p.when)) throw new Error(`planner.tasks: unknown "when" "${p.when}"`);
      if (p.kind && !KINDS.includes(p.kind)) throw new Error(`planner.tasks: unknown day kind "${p.kind}"`);
      const plan = sql.get<{ id: string; name: string; starts_on: IsoDate; ends_on: IsoDate }>(
        "SELECT id, name, starts_on, ends_on FROM plans WHERE is_active = 1",
      );
      if (!plan) return null;
      const from = "FROM plan_tasks t JOIN plan_days d ON d.id = t.day_id";
      const base = ["d.plan_id = ?"];
      const conds = [...base];
      const params: string[] = [plan.id];
      const range = p.range ?? null;
      if (range) {
        conds.push("d.on_date BETWEEN ? AND ?");
        params.push(range.from, range.to);
        if (range.weekday != null) {
          // SQLite's %w counts Sunday as 0; ours counts Monday as 0
          conds.push("strftime('%w', d.on_date) = ?"); // text "0".."6" on both sides
          params.push(String((range.weekday + 1) % 7));
        }
      } else {
        if (p.when === "upcoming") conds.push("d.on_date >= ?");
        if (p.when === "past") conds.push("d.on_date < ?");
        if (p.when !== "all") params.push(p.today);
      }
      if (p.kind) {
        conds.push("d.kind = ?");
        params.push(p.kind);
      }
      const needle = p.search.trim().toLowerCase();
      if (needle) {
        conds.push("(instr(lower(t.body), ?) > 0 OR instr(lower(coalesce(d.title, '')), ?) > 0)");
        params.push(needle, needle);
      }
      const where = conds.join(" AND ");
      const order = p.when === "past" ? "DESC" : "ASC";
      const size = Math.max(1, Math.min(MAX_ROWS, Math.floor(p.days) || 1));
      const m = sql.get<{ days: number; tasks: number; before: number }>(
        `SELECT count(DISTINCT d.id) AS days, count(*) AS tasks,
                count(DISTINCT CASE WHEN d.on_date < ? THEN d.id END) AS before
         ${from} WHERE ${where}`,
        [p.today, ...params],
      )!;
      const pages = Math.max(1, Math.ceil(m.days / size));
      const wanted = p.page ?? (p.when === "all" ? Math.floor(m.before / size) : 0);
      const page = Math.min(Math.max(0, Math.floor(wanted) || 0), pages - 1);
      const rows = sql.all<{
        id: number;
        on_date: IsoDate;
        title: string | null;
        kind: PlanDayKind;
        body: string;
        done: number;
      }>(
        `WITH page AS (SELECT DISTINCT d.id, d.on_date ${from} WHERE ${where}
                       ORDER BY d.on_date ${order} LIMIT ${size} OFFSET ${page * size})
         SELECT t.id, d.on_date, d.title, d.kind, substr(t.body, 1, 400) AS body,
                EXISTS (SELECT 1 FROM plan_task_ticks k WHERE k.task_id = t.id) AS done
         ${from} WHERE ${where} AND d.id IN (SELECT id FROM page)
         ORDER BY d.on_date ${order}, t.position, t.id LIMIT ${MAX_ROWS}`,
        [...params, ...params],
      );
      const c = sql.get<{ all: number; upcoming: number; done: number; days: number }>(
        `SELECT count(*) AS "all", coalesce(sum(d.on_date >= ?), 0) AS upcoming,
                coalesce(sum(EXISTS (SELECT 1 FROM plan_task_ticks k WHERE k.task_id = t.id)), 0) AS done,
                count(DISTINCT d.id) AS days
         ${from} WHERE ${base.join(" AND ")}`,
        [p.today, plan.id],
      )!;
      const linked = !!sql.get(
        "SELECT 1 FROM plan_day_questions q JOIN plan_days d ON d.id = q.day_id WHERE d.plan_id = ? LIMIT 1",
        [plan.id],
      );
      return {
        plan,
        when: p.when,
        range,
        rows: rows.map((r) => ({ ...r, done: !!r.done })),
        page,
        pages,
        matched: { days: m.days, tasks: m.tasks },
        counts: { all: c.all, upcoming: c.upcoming, past: c.all - c.upcoming, done: c.done, days: c.days },
        linked,
      };
    },
  ),
};
