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
import type { AnswerOutcome, QuestionMcqRow, QuestionRow } from "@/types/tables";
import { addDays, weekday, type IsoDate } from "@/lib/dates";
import { buildHero, type HeroDay, type HeroMilestone } from "@/lib/runway";

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
