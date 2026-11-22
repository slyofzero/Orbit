// Dashboard: hero, calendar, day, week, mocks, weakest, standing, milestones.
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.

import { read } from "@/lib/db/queries/core";

import type { PlanDayKind, PlanDayStatus } from "@/types/tables";

import { addDays, type IsoDate } from "@/lib/dates";

import { buildHero, type HeroDay, type HeroMilestone } from "@/lib/runway";
import { carriedInto } from "@/lib/db/queries/carry";

export const dashboardQueries = {
  /** The hero (v1's runway): countdown, plan note, day track with milestone flags, today's tasks, streak. */
  "dashboard.hero": read(["plans", "plan_days", "plan_day_progress", "milestones"], (sql, p: { today: IsoDate }) => {
    const plan = sql.get<{ id: string; starts_on: IsoDate; ends_on: IsoDate }>(
      "SELECT id, starts_on, ends_on FROM plans WHERE is_active = 1",
    );
    const days = plan
      ? sql.all<HeroDay>(
          `SELECT d.on_date, d.title, d.kind, p.status, p.tasks_total, p.tasks_done
           FROM plan_days d JOIN plan_day_progress p ON p.day_id = d.id
           WHERE d.plan_id = ? ORDER BY d.on_date LIMIT 2000`,
          [plan.id],
        )
      : [];
    const milestones = plan
      ? sql.all<HeroMilestone>("SELECT id, name, on_date FROM milestones WHERE plan_id = ? ORDER BY on_date LIMIT 50", [
          plan.id,
        ])
      : [];
    return buildHero({ today: p.today, plan: plan ?? null, days, milestones });
  }),

  /** The calendar: every day of the active plan (kind, title, status) and its milestones. */
  "dashboard.calendar": read(["plans", "plan_days", "plan_day_progress", "milestones"], (sql) => {
    const plan = sql.get<{ id: string }>("SELECT id FROM plans WHERE is_active = 1");
    if (!plan) return { days: [], milestones: [] };
    const days = sql.all<{ on_date: IsoDate; title: string | null; kind: PlanDayKind; status: PlanDayStatus | null }>(
      `SELECT d.on_date, d.title, d.kind, p.status
       FROM plan_days d LEFT JOIN plan_day_progress p ON p.day_id = d.id
       WHERE d.plan_id = ? ORDER BY d.on_date LIMIT 2000`,
      [plan.id],
    );
    const milestones = sql.all<{ id: number; name: string; short: string | null; on_date: IsoDate }>(
      "SELECT id, name, short, on_date FROM milestones WHERE plan_id = ? ORDER BY on_date LIMIT 50",
      [plan.id],
    );
    return { days, milestones };
  }),

  /** The agenda for one date: the day, its tasks (ticked or not), its linked questions (answered, correct),
   *  questions answered that date, topics to practise, the next planned day, the days coming up after today, and
   *  the work carried into it from earlier days (`carried`, docs/PLANS.md §5; lib/db/queries/carry.ts). */
  "dashboard.day": read(
    [
      "plans",
      "plan_days",
      "plan_day_progress",
      "plan_tasks",
      "plan_task_ticks",
      "plan_day_questions",
      "plan_question_ticks",
      "question_answers",
      "questions",
      "topics",
    ],
    (sql, p: { date: IsoDate; today: IsoDate }) => {
      const plan = sql.get<{ id: string }>("SELECT id FROM plans WHERE is_active = 1");
      if (!plan) return null;
      const day =
        sql.get<{
          id: number;
          on_date: IsoDate;
          title: string | null;
          note: string | null;
          kind: PlanDayKind;
          hours: number | null;
          status: PlanDayStatus | null;
        }>(
          `SELECT d.id, d.on_date, d.title, d.note, d.kind, d.hours, p.status
           FROM plan_days d LEFT JOIN plan_day_progress p ON p.day_id = d.id
           WHERE d.plan_id = ? AND d.on_date = ?`,
          [plan.id, p.date],
        ) ?? null;
      const tasks = day
        ? sql
            .all<{ id: number; body: string; done: number }>(
              `SELECT t.id, t.body, (k.task_id IS NOT NULL) AS done
               FROM plan_tasks t LEFT JOIN plan_task_ticks k ON k.task_id = t.id
               WHERE t.day_id = ? ORDER BY t.position LIMIT 200`,
              [day.id],
            )
            .map((t) => ({ ...t, done: t.done === 1 }))
        : [];
      const questions = day
        ? sql.get<{ total: number; answered: number; correct: number }>(
            `SELECT count(*) AS total, count(k.answer_id) AS answered,
                    coalesce(sum(a.outcome = 'correct'), 0) AS correct
             FROM plan_day_questions l
             LEFT JOIN plan_question_ticks k ON k.day_id = l.day_id AND k.question_id = l.question_id
             LEFT JOIN question_answers a ON a.id = k.answer_id
             WHERE l.day_id = ?`,
            [day.id],
          )!
        : { total: 0, answered: 0, correct: 0 };
      const start = Date.parse(`${p.date}T00:00:00+05:30`);
      const answeredOn = sql.get<{ n: number }>(
        `SELECT count(*) AS n FROM question_answers
         WHERE recorded_at >= ? AND recorded_at < ? AND outcome <> 'skipped'`,
        [start, start + 86_400_000],
      )!.n;
      const topics = day
        ? sql.all<{ id: string; name: string }>(
            `SELECT t.id, t.name FROM plan_day_questions l
             JOIN questions q ON q.id = l.question_id JOIN topics t ON t.id = q.topic_id
             WHERE l.day_id = ? AND t.retired_at IS NULL
             GROUP BY t.id ORDER BY min(l.position) LIMIT 3`,
            [day.id],
          )
        : [];
      const next =
        sql.get<{ on_date: IsoDate; title: string | null }>(
          "SELECT on_date, title FROM plan_days WHERE plan_id = ? AND on_date > ? ORDER BY on_date LIMIT 1",
          [plan.id, p.date],
        ) ?? null;
      const upcoming = sql.all<{ on_date: IsoDate; title: string | null; kind: PlanDayKind }>(
        `SELECT on_date, title, kind FROM plan_days
         WHERE plan_id = ? AND on_date > ? AND on_date <> ? ORDER BY on_date LIMIT 4`,
        [plan.id, p.today, p.date],
      );
      const carried = day ? carriedInto(sql, plan.id, p.date, p.today) : { tasks: [], questions: [] };
      return { day, tasks, questions, answeredOn, topics, next, upcoming, carried };
    },
  ),

  /** "Last 7 days": ticked tasks and answered (not skipped) questions, per IST date, for the week ending today. */
  "dashboard.week": read(["plan_task_ticks", "question_answers"], (sql, p: { today: IsoDate }) => {
    const from = Date.parse(`${addDays(p.today, -6)}T00:00:00+05:30`);
    const to = Date.parse(`${p.today}T00:00:00+05:30`) + 86_400_000;
    const rows = sql.all<{ day: IsoDate; tasks: number; questions: number }>(
      `SELECT date(t / 1000, 'unixepoch', '+330 minutes') AS day, sum(k = 't') AS tasks, sum(k = 'q') AS questions FROM (
         SELECT done_at AS t, 't' AS k FROM plan_task_ticks WHERE done_at >= ?1 AND done_at < ?2
         UNION ALL
         SELECT recorded_at, 'q' FROM question_answers WHERE recorded_at >= ?1 AND recorded_at < ?2 AND outcome <> 'skipped'
       ) GROUP BY day LIMIT 7`,
      [from, to],
    );
    return Object.fromEntries(rows.map((r) => [r.day, { tasks: r.tasks, questions: r.questions }])) as Record<
      IsoDate,
      { tasks: number; questions: number }
    >;
  }),

  /** "Mock scores": the 5 newest submitted attempts. */
  "dashboard.mocks": read(["mock_attempts", "mocks"], (sql) =>
    sql.all<{ id: string; name: string; ended_at: number; score: number; max_score: number }>(
      `SELECT a.id, m.name, a.ended_at, a.score, a.max_score
       FROM mock_attempts a JOIN mocks m ON m.id = a.mock_id
       WHERE a.status = 'submitted' ORDER BY a.ended_at DESC LIMIT 5`,
    ),
  ),

  /** "Weakest topics": topics with at least 3 answers (not skipped), lowest share correct first. */
  "dashboard.weakest": read(["question_answers", "questions", "topics"], (sql) =>
    sql.all<{ id: string; name: string; n: number; correct: number }>(
      `SELECT t.id, t.name, count(*) AS n, sum(a.outcome = 'correct') AS correct
       FROM question_answers a JOIN questions q ON q.id = a.question_id JOIN topics t ON t.id = q.topic_id
       WHERE a.outcome <> 'skipped' AND t.retired_at IS NULL
       GROUP BY t.id HAVING count(*) >= 3
       ORDER BY 1.0 * sum(a.outcome = 'correct') / count(*), count(*) DESC LIMIT 5`,
    ),
  ),

  /** "Where you stand": plan tasks done / due, questions answered, mocks taken, topic ratings. */
  "dashboard.standing": read(
    [
      "plans",
      "plan_days",
      "plan_tasks",
      "plan_task_ticks",
      "question_answers",
      "mock_attempts",
      "topics",
      "topic_ratings",
    ],
    (sql, p: { today: IsoDate }) => {
      const plan = sql.get<{ id: string; starts_on: IsoDate }>("SELECT id, starts_on FROM plans WHERE is_active = 1");
      const tasks = plan
        ? sql.get<{ total: number; done: number; due: number; dueDone: number }>(
            `SELECT count(*) AS total, count(k.task_id) AS done,
                    coalesce(sum(d.on_date <= ?2), 0) AS due,
                    coalesce(sum(d.on_date <= ?2 AND k.task_id IS NOT NULL), 0) AS dueDone
             FROM plan_tasks t JOIN plan_days d ON d.id = t.day_id
             LEFT JOIN plan_task_ticks k ON k.task_id = t.id
             WHERE d.plan_id = ?1`,
            [plan.id, p.today],
          )!
        : { total: 0, done: 0, due: 0, dueDone: 0 };
      const answers = sql.get<{ n: number; correct: number }>(
        `SELECT count(*) AS n, coalesce(sum(outcome = 'correct'), 0) AS correct
         FROM question_answers WHERE outcome <> 'skipped'`,
      )!;
      const mocks = sql.get<{ n: number; best: number | null }>(
        `SELECT count(*) AS n, max(100.0 * score / max_score) AS best
         FROM mock_attempts WHERE status = 'submitted' AND max_score > 0`,
      )!;
      const topics = sql.get<{ n: number; known: number; fresh: number; shaky: number }>(
        `SELECT count(*) AS n, coalesce(sum(r.rating = 'know'), 0) AS known, coalesce(sum(r.rating = 'no_idea'), 0) AS fresh, coalesce(sum(r.rating = 'shaky'), 0) AS shaky
         FROM topics t LEFT JOIN topic_ratings r ON r.topic_id = t.id WHERE t.retired_at IS NULL`,
      )!;
      return {
        hasPlan: !!plan,
        started: !!plan && plan.starts_on <= p.today,
        tasksTotal: tasks.total,
        tasksDone: tasks.done,
        openTasks: tasks.due - tasks.dueDone,
        answered: answers.n,
        correct: answers.correct,
        mocks: mocks.n,
        bestMock: mocks.best === null ? null : Math.round(mocks.best),
        topics: topics.n,
        known: topics.known,
        fresh: topics.fresh,
        shaky: topics.shaky,
      };
    },
  ),

  /** "Milestones": the active plan's milestones, by date. */
  "dashboard.milestones": read(["plans", "milestones"], (sql) =>
    sql.all<{ id: number; name: string; short: string | null; on_date: IsoDate; note: string | null }>(
      `SELECT m.id, m.name, m.short, m.on_date, m.note FROM milestones m
       JOIN plans p ON p.id = m.plan_id AND p.is_active = 1 ORDER BY m.on_date LIMIT 50`,
    ),
  ),
};
