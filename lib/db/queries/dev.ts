// Dev-only queries for /dev/db (they refuse to run in production).
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.

import { read, write } from "@/lib/db/queries/core";

import { decode, insertSql } from "@/lib/db/codec";

import { TABLES, type Sql } from "@/lib/db/sql";

import type { AnswerOutcome, QuestionCodeRow, QuestionMcqRow, QuestionRow } from "@/types/tables";

import { addDays, weekday, type IsoDate } from "@/lib/dates";

/** Dev-only queries refuse to run in a production build. */
function devOnly() {
  if (process.env.NODE_ENV === "production") throw new Error("This is a dev-only query.");
}

/** Inserts a bare `questions` row under the dev topic and returns its id (the type's own row is the caller's). */
function devQuestion(sql: Sql, o: { type: QuestionRow["type"]; pool: QuestionRow["pool"]; stem: string }): string {
  const now = Date.now();
  const id = `q_dev${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const q: QuestionRow = {
    id,
    type: o.type,
    topic_id: "tp_dev",
    pack_id: null,
    pool: o.pool,
    marks: 1,
    negative_marks: o.type === "mcq" ? 1 / 3 : 0,
    difficulty: "easy",
    stem: o.stem,
    explanation: null,
    content_hash: id,
    legacy_id: null,
    created_at: now,
    updated_at: now,
    retired_at: null,
  };
  const ins = insertSql("questions", q as unknown as Record<string, unknown>);
  sql.run(ins.query, ins.params);
  return id;
}

export const devQueries = {
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

  /** Adds one sample code question (shows in the Programming tab). */
  "dev.addSampleCode": write(["subjects", "topics", "questions", "question_code"], (sql) => {
    devOnly();
    sql.run("INSERT OR IGNORE INTO subjects (id, name) VALUES ('sb_dev', 'Dev subject')");
    sql.run("INSERT OR IGNORE INTO topics (id, subject_id, name) VALUES ('tp_dev', 'sb_dev', 'Dev topic')");
    const n = sql.get<{ n: number }>("SELECT count(*) + 1 AS n FROM questions WHERE type = 'code'")!.n;
    const id = devQuestion(sql, {
      type: "code",
      pool: "practice",
      stem: `Sample program ${n}: write a function \`total(xs)\` that returns the sum of the list \`xs\`.\n\nFor example, \`total([1, 2, 3])\` is $6$.`,
    });
    const code: QuestionCodeRow = { question_id: id, starter: "def total(xs):\n    # your code here\n    pass\n" };
    const ins = insertSql("question_code", code as unknown as Record<string, unknown>);
    sql.run(ins.query, ins.params);
    return id;
  }),

  /** Adds one sample mock: 30 minutes, one section, three mock-only MCQs (shows in the Mocks tab). */
  "dev.addSampleMock": write(
    ["subjects", "topics", "questions", "question_mcq", "mocks", "mock_sections", "mock_items"],
    (sql) => {
      devOnly();
      sql.run("INSERT OR IGNORE INTO subjects (id, name) VALUES ('sb_dev', 'Dev subject')");
      sql.run("INSERT OR IGNORE INTO topics (id, subject_id, name) VALUES ('tp_dev', 'sb_dev', 'Dev topic')");
      const n = sql.get<{ n: number }>("SELECT count(*) + 1 AS n FROM mocks")!.n;
      const now = Date.now();
      const mockId = `mk_dev${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
      sql.run(
        `INSERT INTO mocks (id, name, instructions, minutes, full_screen, position, created_at, updated_at)
         VALUES (?, ?, ?, 30, 0, ?, ?, ?)`,
        [mockId, `Sample mock ${n}`, "A short sample paper: **3 questions**, 30 minutes.", n, now, now],
      );
      const section = sql.get<{ id: number }>(
        "INSERT INTO mock_sections (mock_id, name, position, minutes) VALUES (?, 'Section A', 1, NULL) RETURNING id",
        [mockId],
      )!.id;
      for (let k = 1; k <= 3; k++) {
        const id = devQuestion(sql, {
          type: "mcq",
          pool: "mock",
          stem: `Mock ${n}, question ${k}: what is $${k} + ${k}$?`,
        });
        const mcq: QuestionMcqRow = {
          question_id: id,
          options: [`$${k}$`, `$${2 * k}$`, `$${3 * k}$`, "$0$"],
          correct: 1,
        };
        const ins = insertSql("question_mcq", mcq as unknown as Record<string, unknown>);
        sql.run(ins.query, ins.params);
        sql.run("INSERT INTO mock_items (section_id, question_id, position) VALUES (?, ?, ?)", [section, id, k]);
      }
      return mockId;
    },
  ),

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
