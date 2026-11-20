// The NAMED QUERIES: the only way screens read or change data (docs/STORAGE.md §2).
// A screen calls useQuery("name", params) / useMutation("name"); the worker looks the name up
// here and runs it. SQL lives in this registry and nowhere else.
//
// Adding one:
//   "plan.day": read(["plan_days", "plan_tasks"], (sql, p: { date: IsoDate }) => …),
//   "plan.tickTask": write(["plan_task_ticks"], (sql, p: { taskId: number }) => …),
//   * read(tables, fn): `tables` = every table the SQL reads. When any of them changes (in any
//     tab), screens using the query re-run it.
//   * write(tables, fn): `tables` = the tables the SQL itself writes. Tables changed by
//     triggers and cascades are worked out from the schema (lib/db/effects.ts). The whole
//     function runs in one transaction.
//   * Params and results must be plain data (objects, arrays, strings, numbers, Uint8Array):
//     they are copied between threads and tabs.
//   * Convert rows with decode() / insertSql() (lib/db/codec.ts) so screens get the types in
//     types/tables/, never raw JSON text or 0/1.
//   * Every list has a LIMIT. Pure logic (grading, streaks…) stays in lib/ and is called from here.

import { decode, insertSql } from "@/lib/db/codec";
import { TABLES, type Sql, type TableName } from "@/lib/db/sql";
import type { AnswerOutcome, PlanDayKind, PlanDayStatus, QuestionMcqRow, QuestionRow } from "@/types/tables";
import { addDays, weekday, type IsoDate } from "@/lib/dates";
import { buildHero, type HeroDay, type HeroMilestone } from "@/lib/runway";
import { parsePlanFile } from "@/lib/planFile";
import type { PlannerDay } from "@/lib/planner";

export interface QueryDef<P, R> {
  kind: "read" | "write";
  tables: readonly TableName[];
  run: (sql: Sql, params: P) => R;
}

function read<P = void, R = unknown>(tables: readonly TableName[], run: (sql: Sql, params: P) => R): QueryDef<P, R> {
  return { kind: "read", tables, run };
}
function write<P = void, R = unknown>(tables: readonly TableName[], run: (sql: Sql, params: P) => R): QueryDef<P, R> {
  return { kind: "write", tables, run };
}

/** Dev-only queries refuse to run in a production build. */
function devOnly() {
  if (process.env.NODE_ENV === "production") throw new Error("This is a dev-only query.");
}

export const QUERIES = {
  // ---------------------------------------------------------------- database
  /** Row count of every table (for /dev/db and backups). */
  "db.counts": read(TABLES, (sql) =>
    TABLES.map((table) => ({ table, rows: sql.get<{ n: number }>(`SELECT count(*) AS n FROM ${table}`)!.n })),
  ),

  // ---------------------------------------------------------------- dashboard
  /** What is loaded yet: an active plan, and any (not retired) questions. Drives "Set up your study space". */
  "setup.status": read(["plans", "questions"], (sql) => {
    const r = sql.get<{ plan: number; questions: number }>(
      `SELECT EXISTS (SELECT 1 FROM plans WHERE is_active = 1) AS plan,
              EXISTS (SELECT 1 FROM questions WHERE retired_at IS NULL) AS questions`,
    )!;
    return { hasPlan: r.plan === 1, hasQuestions: r.questions === 1 };
  }),

  /** Imports a plan file (lib/planFile.ts) and makes it the active plan. The file is checked again here,
   *  so nothing unchecked is ever saved; on any error nothing is written. Question ids that aren't in the
   *  bank yet are skipped (and counted). */
  "plan.import": write(
    ["plans", "plan_days", "plan_tasks", "plan_day_questions", "milestones"],
    (sql, p: { text: string }) => {
      const r = parsePlanFile(p.text);
      if (!r.plan) return { ok: false as const, errors: r.errors, warnings: r.warnings };
      const plan = r.plan;
      const now = Date.now();
      const id = `pl_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      sql.run("UPDATE plans SET is_active = 0 WHERE is_active = 1");
      sql.run(
        `INSERT INTO plans (id, name, description, starts_on, ends_on, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, plan.name, plan.description, plan.starts_on, plan.ends_on, now, now],
      );
      let tasks = 0;
      let links = 0;
      let skipped = 0;
      for (const d of plan.days) {
        const dayId = sql.get<{ id: number }>(
          "INSERT INTO plan_days (plan_id, on_date, title, note, kind, hours) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
          [id, d.date, d.title, d.note, d.kind, d.hours],
        )!.id;
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
      return {
        ok: true as const,
        planId: id,
        name: plan.name,
        days: plan.days.length,
        tasks,
        links,
        milestones: plan.milestones.length,
        warnings,
      };
    },
  ),

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
   *  questions answered that date, topics to practise, the next planned day and the days coming up after today. */
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
      return { day, tasks, questions, answeredOn, topics, next, upcoming };
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
      const mocks = sql.get<{ n: number }>("SELECT count(*) AS n FROM mock_attempts WHERE status = 'submitted'")!.n;
      const topics = sql.get<{ n: number; fresh: number; shaky: number }>(
        `SELECT count(*) AS n, coalesce(sum(r.rating = 'no_idea'), 0) AS fresh, coalesce(sum(r.rating = 'shaky'), 0) AS shaky
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
        mocks,
        topics: topics.n,
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

  // ---------------------------------------------------------------- planner
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

  // ---------------------------------------------------------------- plan progress
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

  // ---------------------------------------------------------------- dev (/dev/db)
  /** Adds one sample MCQ (and the subject / topic it needs). */
  "dev.addSampleQuestion": write(["subjects", "topics", "questions", "question_mcq"], (sql) => {
    devOnly();
    sql.run("INSERT OR IGNORE INTO subjects (id, name) VALUES ('sb_dev', 'Dev subject')");
    sql.run("INSERT OR IGNORE INTO topics (id, subject_id, name) VALUES ('tp_dev', 'sb_dev', 'Dev topic')");
    const n = sql.get<{ n: number }>("SELECT count(*) + 1 AS n FROM questions")!.n;
    const now = Date.now();
    const id = `q_dev${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`; // random: two in one ms must differ
    const q: QuestionRow = {
      id,
      type: "mcq",
      topic_id: "tp_dev",
      pack_id: null,
      pool: "practice",
      marks: 1,
      negative_marks: 1 / 3,
      difficulty: "easy",
      stem: `Sample question ${n}: what is $\\int_0^1 ${n}x\\,dx$?`,
      explanation: null,
      content_hash: id,
      legacy_id: null,
      created_at: now,
      updated_at: now,
      retired_at: null,
    };
    const mcq: QuestionMcqRow = { question_id: id, options: [`$${n / 2}$`, `$${n}$`, `$${n * 2}$`, "$0$"], correct: 0 };
    for (const [table, row] of [
      ["questions", q],
      ["question_mcq", mcq],
    ] as const) {
      const ins = insertSql(table, row as unknown as Record<string, unknown>);
      sql.run(ins.query, ins.params);
    }
    return id;
  }),

  /** Answers a random question with a random outcome (watch question_stats change). */
  "dev.answerRandom": write(["question_answers"], (sql) => {
    devOnly();
    const q = sql.get<{ id: string }>("SELECT id FROM questions WHERE retired_at IS NULL ORDER BY random() LIMIT 1");
    if (!q) return null;
    const outcomes: AnswerOutcome[] = ["correct", "incorrect", "skipped"];
    const outcome = outcomes[Math.floor(Math.random() * 3)];
    sql.run("INSERT INTO question_answers (question_id, recorded_at, outcome, time_ms) VALUES (?, ?, ?, ?)", [
      q.id,
      Date.now(),
      outcome,
      Math.floor(Math.random() * 90_000),
    ]);
    return { question_id: q.id, outcome };
  }),

  /** The newest question with its MCQ row, decoded (options come back as an array). */
  "dev.latestQuestion": read(["questions", "question_mcq", "question_stats"], (sql) => {
    devOnly();
    const row = sql.get("SELECT * FROM questions ORDER BY created_at DESC LIMIT 1");
    if (!row) return null;
    const question = decode<QuestionRow>("questions", row);
    const mcqRow = sql.get("SELECT * FROM question_mcq WHERE question_id = ?", [question.id]);
    const stats = sql.get<{ visited: number; correct: number; incorrect: number }>(
      "SELECT visited, correct, incorrect FROM question_stats WHERE question_id = ?",
      [question.id],
    );
    return { question, mcq: mcqRow ? decode<QuestionMcqRow>("question_mcq", mcqRow) : null, stats: stats ?? null };
  }),

  /** Replaces the sample plan: 92 days around `today` (Sundays off), 4 milestones, some past days ticked. */
  "dev.samplePlan": write(
    ["plans", "plan_days", "plan_tasks", "plan_task_ticks", "milestones"],
    (sql, p: { today: IsoDate }) => {
      devOnly();
      const now = Date.now();
      const start = addDays(p.today, -12);
      sql.run("DELETE FROM plans WHERE id = 'pl_sample'");
      sql.run("UPDATE plans SET is_active = 0");
      sql.run(
        `INSERT INTO plans (id, name, starts_on, ends_on, is_active, created_at, updated_at)
         VALUES ('pl_sample', 'Sample plan', ?, ?, 1, ?, ?)`,
        [start, addDays(start, 91), now, now],
      );
      const kinds = ["study", "study", "light", "study", "crunch", "mock"] as const;
      for (let i = 0; i < 92; i++) {
        const date = addDays(start, i);
        if (weekday(date) === 6) continue; // Sunday off
        const id = sql.get<{ id: number }>(
          "INSERT INTO plan_days (plan_id, on_date, title, kind, hours) VALUES ('pl_sample', ?, ?, ?, ?) RETURNING id",
          [date, `Sample topic ${(i % 7) + 1}`, kinds[i % kinds.length], 3],
        )!.id;
        for (let k = 0; k < 4; k++) {
          const task = sql.get<{ id: number }>(
            "INSERT INTO plan_tasks (day_id, position, body) VALUES (?, ?, ?) RETURNING id",
            [id, k + 1, `Task ${k + 1}`],
          )!.id;
          // past days: most finished, every 4th missed; today: the first task
          const done = date < p.today ? i % 4 !== 1 || k === 0 : date === p.today && k === 0;
          if (done) sql.run("INSERT INTO plan_task_ticks (task_id, done_at) VALUES (?, ?)", [task, now]);
        }
      }
      for (const [name, offset] of [
        ["Quiz 1", -5],
        ["Quiz 2", 15],
        ["End Term", 51],
        ["Final", 79],
      ] as const)
        sql.run("INSERT INTO milestones (plan_id, name, on_date) VALUES ('pl_sample', ?, ?)", [
          name,
          addDays(p.today, offset),
        ]);
      return true;
    },
  ),

  /** Deletes ALL data in this profile. Dev only. */
  "dev.clearAll": write(TABLES, (sql) => {
    devOnly();
    // Parents of cascades first, so nothing is blocked by a foreign key.
    for (const t of [
      "plans",
      "question_answers",
      "mock_attempts",
      "mocks",
      "questions",
      "topic_ratings",
      "topics",
      "subjects",
      "tags",
      "packs",
      "images",
    ])
      sql.run(`DELETE FROM ${t}`);
    return true;
  }),
};

export type QueryName = keyof typeof QUERIES;
export type ParamsOf<N extends QueryName> = (typeof QUERIES)[N] extends QueryDef<infer P, unknown> ? P : never;
export type ResultOf<N extends QueryName> = (typeof QUERIES)[N] extends QueryDef<never, infer R> ? R : never;
/** The arguments after the name: none for queries without params. */
export type ArgsOf<N extends QueryName> = [ParamsOf<N>] extends [void] ? [] : [ParamsOf<N>];
