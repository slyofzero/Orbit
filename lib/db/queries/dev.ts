// Dev-only queries for /dev/db and the Practice tabs' DEV buttons (they refuse to run in production).
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.
// The "add a sample" buttons import a small question file (lib/samplePacks.ts) through pack.import, exactly like an
// uploaded file, so each sample is a real pack (listed in Manage pack → Upload, removable there).

import { read, write } from "@/lib/db/queries/core";

import { decode } from "@/lib/db/codec";

import { TABLES, type Sql } from "@/lib/db/sql";

import { packQueries } from "@/lib/db/queries/pack";

import { sampleFile, sampleFileName, type SampleKind } from "@/lib/samplePacks";

import type { AnswerOutcome, QuestionMcqRow, QuestionRow } from "@/types/tables";

import { addDays, weekday, type IsoDate } from "@/lib/dates";

/** Dev-only queries refuse to run in a production build. */
function devOnly() {
  if (process.env.NODE_ENV === "production") throw new Error("This is a dev-only query.");
}

const IMPORT = packQueries["pack.import"];

/** Imports the next sample of a kind through pack.import and returns the new pack's id. The number is the first
 *  one whose question isn't in the bank yet, so the importer never skips it as already there. */
function importSample(sql: Sql, kind: SampleKind): string {
  let n = sql.get<{ n: number }>("SELECT count(*) + 1 AS n FROM packs")!.n;
  const firstText = (k: number) => sampleFile(kind, k).questions[0].text;
  while (sql.get("SELECT 1 FROM questions WHERE stem = ? AND retired_at IS NULL LIMIT 1", [firstText(n)])) n++;
  const r = IMPORT.run(sql, {
    text: JSON.stringify(sampleFile(kind, n), null, 2),
    fileName: sampleFileName(kind, n),
    fileHash: null,
  });
  if (!r.ok) throw new Error(`The sample ${kind} didn't import: ${r.errors[0]}`);
  return r.packId;
}

export const devQueries = {
  /** Adds one sample practice MCQ (a one-question pack). Returns the question's id. */
  "dev.addSampleQuestion": write(IMPORT.tables, (sql) => {
    devOnly();
    const pack = importSample(sql, "question");
    return sql.get<{ id: string }>("SELECT id FROM questions WHERE pack_id = ? LIMIT 1", [pack])!.id;
  }),

  /** Adds one sample code question (a one-question pack; shows in the Programming tab). Returns its id. */
  "dev.addSampleCode": write(IMPORT.tables, (sql) => {
    devOnly();
    const pack = importSample(sql, "code");
    return sql.get<{ id: string }>("SELECT id FROM questions WHERE pack_id = ? LIMIT 1", [pack])!.id;
  }),

  /** Adds one sample mock (a pack with a 30-minute full-screen mock of three mock-only MCQs; shows in the Mocks
   *  tab). Returns the mock's id. */
  "dev.addSampleMock": write(IMPORT.tables, (sql) => {
    devOnly();
    const pack = importSample(sql, "mock");
    return sql.get<{ id: string }>("SELECT id FROM mocks WHERE pack_id = ? LIMIT 1", [pack])!.id;
  }),

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
