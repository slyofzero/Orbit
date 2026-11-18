// The small database interface every query is written against. The worker implements it over
// SQLite WASM (lib/db/worker.ts); scripts/check.ts implements it over bun:sqlite, so the same
// queries are tested without a browser.

export type SqlValue = string | number | null | Uint8Array;
/** Positional parameters, bound to the `?` marks in order. */
export type Bind = readonly SqlValue[];
export type Row = Record<string, SqlValue>;

export interface Sql {
  /** Every row of a SELECT. */
  all<T = Row>(query: string, params?: Bind): T[];
  /** The first row of a SELECT, or undefined. */
  get<T = Row>(query: string, params?: Bind): T | undefined;
  /** Runs one INSERT / UPDATE / DELETE and returns how many rows it changed. */
  run(query: string, params?: Bind): number;
  /** Runs a script of several statements (schema, migrations). No parameters, no results. */
  exec(script: string): void;
}

/** Every table in db/schema.sql (not the search index). bun run check keeps this list exact. */
export const TABLES = [
  "subjects",
  "topics",
  "topic_ratings",
  "tags",
  "packs",
  "images",
  "questions",
  "question_mcq",
  "question_msq",
  "question_nat",
  "question_str",
  "question_code",
  "question_tags",
  "question_images",
  "question_answers",
  "question_stats",
  "mocks",
  "mock_sections",
  "mock_items",
  "mock_attempts",
  "mock_attempt_items",
  "plans",
  "plan_days",
  "plan_tasks",
  "plan_day_questions",
  "plan_task_ticks",
  "plan_question_ticks",
  "plan_day_progress",
] as const;
export type TableName = (typeof TABLES)[number];

/** Runs `fn` inside one transaction: all of it is saved, or none of it. */
export function transaction<T>(sql: Sql, fn: () => T): T {
  sql.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    sql.exec("COMMIT");
    return out;
  } catch (e) {
    sql.exec("ROLLBACK");
    throw e;
  }
}
