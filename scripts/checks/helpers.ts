// Shared by every file in scripts/checks: the pass/fail counter, a fresh in-memory database and small fixtures.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Bind, Sql } from "@/lib/db/sql";

/** How many checks failed so far (scripts/check.ts prints it at the end). */
export const results = { failed: 0 };
export function ok(cond: unknown, label: string) {
  if (cond) console.log("  ok   " + label);
  else {
    results.failed++;
    console.log("  FAIL " + label);
  }
}

export const schema = readFileSync(join(import.meta.dir, "..", "..", "db", "schema.sql"), "utf8");
export function freshDb() {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(schema);
  return db;
}

// Fixtures
export const run = (d: Database, sql: string) => d.exec(sql);
export const count = (d: Database, sql: string) => (d.query(sql).get() as { n: number }).n;
export const throwsMsg = (fn: () => unknown, part: string) => {
  try {
    fn();
    return false;
  } catch (e) {
    return String(e).toLowerCase().includes(part.toLowerCase());
  }
};
export const refuses = (d: Database, sql: string) => {
  try {
    d.exec(sql);
    return false;
  } catch {
    return true;
  }
};
export function seed(d: Database, nQuestions: number) {
  run(d, "INSERT INTO subjects(id, name) VALUES ('sb_1', 'Subject')");
  run(d, "INSERT INTO topics(id, subject_id, name) VALUES ('tp_1', 'sb_1', 'Topic')");
  const q =
    d.prepare(`INSERT INTO questions(id, type, topic_id, marks, difficulty, stem, content_hash, created_at, updated_at)
                       VALUES (?, 'mcq', 'tp_1', 1, 'easy', ?, ?, 0, 0)`);
  const mcq = d.prepare(`INSERT INTO question_mcq(question_id, options, correct) VALUES (?, '["a","b","c","d"]', 0)`);
  for (let i = 0; i < nQuestions; i++) {
    q.run(`q_${i}`, `word${i} common stem`, `h${i}`);
    mcq.run(`q_${i}`);
  }
}
// IST midnight of a date, in Unix ms (+ an offset in hours).
export const at = (date: string, hours = 12) => Date.parse(`${date}T00:00:00+05:30`) + hours * 3_600_000;

// lib/db: the same code the worker runs, over bun:sqlite instead of SQLite WASM.
export function bunSql(d: Database): Sql {
  return {
    all: <T>(q: string, p: Bind = []) => d.query(q).all(...(p as never[])) as T[],
    get: <T>(q: string, p: Bind = []) => (d.query(q).get(...(p as never[])) ?? undefined) as T | undefined,
    run: (q: string, p: Bind = []) => d.query(q).run(...(p as never[])).changes,
    exec: (s: string) => void d.exec(s),
  };
}
