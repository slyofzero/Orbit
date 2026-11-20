// Logic test suite. Must print "ALL OK". Run: bun run check
// Uses bun's built-in SQLite to verify db/schema.sql; the app itself uses the WASM build in a worker.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseInline, parseMarkdown } from "@/lib/markdown";
import { applyEdit, insertBlock, replaceWithBlock, toggleLines, wrap, type Edit } from "@/lib/editing";
import { hashImage, imageProblem, imageRef, refToHash } from "@/lib/images";
import * as cIndent from "@/lib/codeIndent";
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  formatDate,
  formatLong,
  formatShort,
  isIsoDate,
  istHour,
  monthGrid,
  todayIST,
  weekday,
} from "@/lib/dates";
import { gradeMcq, gradeMsq, gradeNat, gradeStr, marksFor, parseNumber } from "@/lib/grade";
import { QUOTES, nextOrder, shuffledOrder } from "@/lib/quotes";
import { buildHero, streak } from "@/lib/runway";
import {
  dayHeading,
  dayHelpPrompt,
  dayLock,
  dayTally,
  focusDay,
  lastDays,
  standingLine,
  topicsLine,
} from "@/lib/dashboard";
import { parsePlanFile, planSummary } from "@/lib/planFile";
import {
  carouselDays,
  cardLabel,
  dayCount,
  dayState,
  emptyDayNote,
  groupByMonth,
  missedDays,
  stripLabel,
  stripSegments,
  windowDays,
  type PlannerDay,
} from "@/lib/planner";
import { examplePlan, planPrompt } from "@/lib/prompts/planPrompt";
import { BOOL_COLUMNS, JSON_COLUMNS, decode, encode } from "@/lib/db/codec";
import { affectedTables, readEffects } from "@/lib/db/effects";
import { latestVersion, migrate } from "@/lib/db/migrate";
import { QUERIES, type QueryDef } from "@/lib/db/queries";
import { TABLES, transaction, type Bind, type Sql, type TableName } from "@/lib/db/sql";

let failed = 0;
function ok(cond: unknown, label: string) {
  if (cond) console.log("  ok   " + label);
  else {
    failed++;
    console.log("  FAIL " + label);
  }
}

const schema = readFileSync(join(import.meta.dir, "..", "db", "schema.sql"), "utf8");
function freshDb() {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(schema);
  return db;
}

// ---------------------------------------------------------------------------
console.log("schema");
let db: Database;
try {
  db = freshDb();
  ok(true, "db/schema.sql loads");
} catch (e) {
  ok(false, "db/schema.sql loads: " + String(e));
  process.exit(1);
}
ok((db.query("PRAGMA user_version").get() as { user_version: number }).user_version === 1, "user_version = 1");
ok(db.query("PRAGMA foreign_key_check").all().length === 0, "no foreign key violations");
{
  // Every table in types/tables/ exists in the SQL with exactly the same columns.
  const typesDir = join(import.meta.dir, "..", "types", "tables");
  const files = new Bun.Glob("**/*.ts").scanSync(typesDir);
  let checked = 0;
  for (const rel of files) {
    const src = readFileSync(join(typesDir, rel), "utf8");
    const table = src.match(/^\/\/ Table `(\w+)`/m)?.[1];
    if (!table) continue;
    const body = src.match(/export interface \w+ \{([\s\S]*?)\n\}/)?.[1] ?? "";
    const tsCols = [...body.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]).sort();
    const sqlCols = (db.query(`SELECT name FROM pragma_table_xinfo('${table}')`).all() as { name: string }[])
      .map((r) => r.name)
      .sort();
    ok(JSON.stringify(tsCols) === JSON.stringify(sqlCols), `${table}: SQL columns = TS type`);
    checked++;
  }
  ok(checked >= 28, `every table type checked against the SQL (${checked})`);
}

// ---------------------------------------------------------------------------
// Fixtures
const run = (d: Database, sql: string) => d.exec(sql);
const count = (d: Database, sql: string) => (d.query(sql).get() as { n: number }).n;
const throwsMsg = (fn: () => unknown, part: string) => {
  try {
    fn();
    return false;
  } catch (e) {
    return String(e).toLowerCase().includes(part.toLowerCase());
  }
};
const refuses = (d: Database, sql: string) => {
  try {
    d.exec(sql);
    return false;
  } catch {
    return true;
  }
};
function seed(d: Database, nQuestions: number) {
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
const at = (date: string, hours = 12) => Date.parse(`${date}T00:00:00+05:30`) + hours * 3_600_000;

// ---------------------------------------------------------------------------
console.log("schema: question rules");
{
  db = freshDb();
  seed(db, 2);
  run(
    db,
    "INSERT INTO questions(id, type, topic_id, marks, difficulty, stem, content_hash, created_at, updated_at) VALUES ('q_n', 'nat', 'tp_1', 2, 'hard', 'n', 'hn', 0, 0)",
  );
  ok(refuses(db, `INSERT INTO question_mcq VALUES ('q_n', '["a","b"]', 0)`), "an mcq row on a nat question is refused");
  ok(refuses(db, `INSERT INTO question_nat VALUES ('q_0', 1, 0)`), "a nat row on an mcq question is refused");
  ok(!refuses(db, `INSERT INTO question_nat VALUES ('q_n', 2.5, 0.01)`), "a nat row on a nat question is saved");
  ok(refuses(db, "UPDATE questions SET type = 'msq' WHERE id = 'q_0'"), "a question's type can't change");
  ok(
    refuses(db, `UPDATE question_mcq SET correct = 4 WHERE question_id = 'q_0'`),
    "mcq correct out of range is refused",
  );
  ok(
    refuses(db, `UPDATE question_mcq SET options = '["only"]' WHERE question_id = 'q_0'`),
    "mcq with 1 option is refused",
  );
  ok(
    refuses(db, `UPDATE question_mcq SET options = 'a,b' WHERE question_id = 'q_0'`),
    "options that aren't JSON are refused",
  );
  ok(refuses(db, "UPDATE questions SET marks = 0 WHERE id = 'q_0'"), "marks must be > 0");
  run(db, "INSERT INTO question_answers(question_id, recorded_at, outcome) VALUES ('q_1', 1, 'correct')");
  ok(refuses(db, "DELETE FROM questions WHERE id = 'q_1'"), "an answered question can't be deleted (retire it)");
}

// ---------------------------------------------------------------------------
console.log("schema: search index");
{
  const path = join(process.env.TEMP ?? "/tmp", `orbit-check-${process.pid}.sqlite3`);
  const f = new Database(path);
  try {
    f.exec("PRAGMA foreign_keys = ON;");
    f.exec(schema);
    seed(f, 6);
    const find = (word: string) =>
      (
        f
          .query(`SELECT question_id FROM questions_fts WHERE questions_fts MATCH '{stem explanation} : ${word}'`)
          .all() as { question_id: string }[]
      ).map((r) => r.question_id);
    f.exec("DELETE FROM questions WHERE id IN ('q_0', 'q_2')"); // leave gaps that VACUUM could close
    f.exec("VACUUM");
    ok(JSON.stringify(find("word4")) === '["q_4"]', "search finds the right question after VACUUM");
    ok(find("word0").length === 0, "a deleted question leaves the index");
    f.exec("UPDATE questions SET stem = 'renamed eigen' WHERE id = 'q_3'");
    ok(find("word3").length === 0 && JSON.stringify(find("eigen")) === '["q_3"]', "an edited stem is re-indexed");
    ok(find("common").length === 3, "the other questions are untouched");
    f.exec("INSERT INTO questions_fts(questions_fts) VALUES ('integrity-check')");
    ok(true, "FTS integrity-check passes");
  } catch (e) {
    ok(false, "search index: " + String(e));
  } finally {
    f.close();
    try {
      require("node:fs").unlinkSync(path);
    } catch {}
  }
}

// ---------------------------------------------------------------------------
console.log("schema: question_stats triggers = full rebuild");
{
  const REBUILD = `SELECT question_id, COUNT(*) AS visited, SUM(outcome = 'correct') AS correct,
                          SUM(outcome = 'incorrect') AS incorrect
                   FROM question_answers GROUP BY question_id ORDER BY question_id`;
  const CACHED = "SELECT question_id, visited, correct, incorrect FROM question_stats ORDER BY question_id";
  const same = (label: string) =>
    ok(JSON.stringify(db.query(CACHED).all()) === JSON.stringify(db.query(REBUILD).all()), label);

  db = freshDb();
  seed(db, 20);
  run(db, "INSERT INTO mocks(id, name, minutes, created_at, updated_at) VALUES ('mk_1', 'Mock', 180, 0, 0)");
  let s = 7;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const ans = db.prepare(
    "INSERT INTO question_answers(question_id, recorded_at, outcome, time_ms) VALUES (?, ?, ?, ?)",
  );
  const outcomes = ["correct", "incorrect", "skipped"];
  for (let i = 0; i < 400; i++)
    ans.run(`q_${Math.floor(rnd() * 20)}`, Math.floor(rnd() * 1e6), outcomes[Math.floor(rnd() * 3)], 500);
  same("after 400 practice answers");

  // A mock: answers are refused until it is submitted.
  run(
    db,
    `INSERT INTO mock_attempts(id, mock_id, sections, minutes, started_at) VALUES ('at_1', 'mk_1', '[{"name":"S","minutes":null}]', 180, 0)`,
  );
  ok(
    refuses(
      db,
      "INSERT INTO question_answers(question_id, recorded_at, outcome, attempt_id) VALUES ('q_0', 1, 'correct', 'at_1')",
    ),
    "mock answers are refused before submit",
  );
  ok(
    refuses(
      db,
      `INSERT INTO mock_attempts(id, mock_id, sections, minutes, started_at) VALUES ('at_x', 'mk_1', '[{"name":"S"}]', 180, 0)`,
    ),
    "only one attempt can be in progress",
  );
  ok(
    refuses(db, "UPDATE mock_attempts SET status = 'submitted', ended_at = 5 WHERE id = 'at_1'"),
    "submitted needs a score",
  );
  run(db, "UPDATE mock_attempts SET status = 'submitted', ended_at = 5, score = 3, max_score = 10 WHERE id = 'at_1'");
  for (let i = 0; i < 10; i++)
    run(
      db,
      `INSERT INTO question_answers(question_id, recorded_at, outcome, time_ms, attempt_id)
             VALUES ('q_${i}', 5, '${outcomes[i % 3]}', 1000, 'at_1')`,
    );
  same("after a submitted mock");
  ok(
    refuses(
      db,
      "INSERT INTO question_answers(question_id, recorded_at, outcome, attempt_id) VALUES ('q_0', 6, 'correct', 'at_1')",
    ),
    "one answer per question per attempt",
  );
  ok(
    refuses(db, "UPDATE mock_attempts SET status = 'abandoned' WHERE id = 'at_1'"),
    "a finished attempt stays finished",
  );

  run(db, "DELETE FROM question_answers WHERE id % 5 = 0 AND attempt_id IS NULL");
  same("after deleting some practice answers");
  run(db, "UPDATE question_answers SET outcome = 'correct' WHERE id % 7 = 0");
  same("after changing some outcomes");
  run(db, "DELETE FROM mock_attempts WHERE id = 'at_1'");
  ok(
    count(db, "SELECT count(*) AS n FROM question_answers WHERE attempt_id = 'at_1'") === 0,
    "deleting an attempt deletes its answers",
  );
  same("after deleting a whole attempt");
  run(db, "DELETE FROM question_answers");
  ok(count(db, "SELECT count(*) AS n FROM question_stats") === 0, "deleting every answer empties question_stats");

  run(db, "INSERT INTO mock_sections(id, mock_id, name, position) VALUES (1, 'mk_1', 'A', 1), (2, 'mk_1', 'B', 2)");
  run(db, "INSERT INTO mock_items VALUES (1, 'q_0', 1)");
  ok(refuses(db, "INSERT INTO mock_items VALUES (2, 'q_0', 1)"), "a question can't be in two sections of one mock");
}

// ---------------------------------------------------------------------------
console.log("schema: plan progress");
{
  const REBUILD = `SELECT day_id, tasks_total, tasks_done, questions_total, questions_done, done_at
                   FROM v_plan_day_progress ORDER BY day_id`;
  const CACHED = `SELECT day_id, tasks_total, tasks_done, questions_total, questions_done, done_at
                  FROM plan_day_progress ORDER BY day_id`;
  const same = (label: string) =>
    ok(JSON.stringify(db.query(CACHED).all()) === JSON.stringify(db.query(REBUILD).all()), label);
  const status = (day: number) =>
    (db.query(`SELECT status FROM plan_day_progress WHERE day_id = ${day}`).get() as { status: string | null }).status;

  db = freshDb();
  seed(db, 10);
  run(
    db,
    `INSERT INTO plans(id, name, starts_on, ends_on, is_active, created_at, updated_at)
           VALUES ('pl_1', 'Plan', '2026-01-01', '2026-01-31', 1, 0, 0)`,
  );
  ok(
    refuses(
      db,
      `INSERT INTO plans(id, name, starts_on, ends_on, is_active, created_at, updated_at) VALUES ('pl_2', 'P', '2026-01-01', '2026-01-02', 1, 0, 0)`,
    ),
    "only one plan can be active",
  );
  ok(
    refuses(db, "INSERT INTO plan_days(plan_id, on_date) VALUES ('pl_1', '2026-02-01')"),
    "a day outside the plan is refused",
  );
  for (let d = 1; d <= 5; d++)
    run(db, `INSERT INTO plan_days(id, plan_id, on_date) VALUES (${d}, 'pl_1', '2026-01-0${d}')`);
  ok(refuses(db, "UPDATE plans SET ends_on = '2026-01-03' WHERE id = 'pl_1'"), "a plan can't shrink past its days");
  ok(status(1) === null, "a day with nothing planned has no status (rest day)");

  // Day 1: 2 tasks + 2 questions. Day 2: 1 task. Day 3: q_0 again. Day 5 (future): q_0.
  run(
    db,
    "INSERT INTO plan_tasks(id, day_id, position, body) VALUES (1, 1, 1, 'Read'), (2, 1, 2, 'Notes'), (3, 2, 1, 'Revise')",
  );
  run(db, "INSERT INTO plan_day_questions VALUES (1, 'q_0', 1), (1, 'q_1', 2), (3, 'q_0', 1), (5, 'q_0', 1)");
  ok(status(1) === "incomplete", "nothing done = incomplete");
  run(db, `INSERT INTO plan_task_ticks VALUES (1, ${at("2026-01-01")})`);
  ok(status(1) === "partial", "some done = partial");

  // Answering on Jan 3 ticks q_0 on days 1 and 3, not on day 5 (future). Skips tick nothing.
  run(
    db,
    `INSERT INTO question_answers(question_id, recorded_at, outcome) VALUES ('q_1', ${at("2026-01-03")}, 'skipped')`,
  );
  ok(
    count(db, "SELECT count(*) AS n FROM plan_question_ticks WHERE question_id = 'q_1'") === 0,
    "a skipped answer ticks nothing",
  );
  run(
    db,
    `INSERT INTO question_answers(question_id, recorded_at, outcome) VALUES ('q_0', ${at("2026-01-03", 23.9)}, 'incorrect')`,
  );
  ok(
    JSON.stringify(
      db.query("SELECT day_id FROM plan_question_ticks WHERE question_id = 'q_0' ORDER BY day_id").all(),
    ) === '[{"day_id":1},{"day_id":3}]',
    "an answer ticks past and today's links (IST), not future ones",
  );
  ok(status(3) === "done", "a wrong answer still counts as done");
  run(
    db,
    `INSERT INTO question_answers(question_id, recorded_at, outcome) VALUES ('q_1', ${at("2026-01-03")}, 'correct')`,
  );
  run(db, `INSERT INTO plan_task_ticks VALUES (2, ${at("2026-01-04")})`);
  ok(status(1) === "done", "everything done = done (late work counts)");
  ok(
    (db.query("SELECT done_at FROM plan_day_progress WHERE day_id = 1").get() as { done_at: number }).done_at ===
      at("2026-01-04"),
    "done_at = when the last item was done",
  );
  same("after ticks and answers");

  run(db, "INSERT INTO plan_tasks(id, day_id, position, body) VALUES (4, 1, 1.5, 'Extra')");
  ok(status(1) === "partial", "adding a task to a done day makes it partial");
  run(db, "DELETE FROM plan_task_ticks WHERE task_id = 1");
  run(db, "UPDATE plan_tasks SET day_id = 2 WHERE id = 4");
  run(db, "DELETE FROM plan_tasks WHERE id = 2");
  run(db, "DELETE FROM plan_day_questions WHERE day_id = 3");
  same("after unticking, moving and deleting items");
  run(db, "DELETE FROM question_answers WHERE question_id = 'q_0'");
  ok(
    count(db, "SELECT count(*) AS n FROM plan_question_ticks WHERE question_id = 'q_0'") === 0,
    "deleting the answer removes its ticks",
  );
  same("after deleting answers");
  run(db, "DELETE FROM plan_days WHERE id = 1");
  ok(
    count(db, "SELECT count(*) AS n FROM plan_day_progress WHERE day_id = 1") === 0,
    "deleting a day deletes its progress",
  );
  same("after deleting a day");
  run(db, "DELETE FROM plans");
  ok(count(db, "SELECT count(*) AS n FROM plan_day_progress") === 0, "deleting the plan deletes everything under it");
  ok(db.query("PRAGMA foreign_key_check").all().length === 0, "no foreign key violations at the end");
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// lib/db: the same code the worker runs, over bun:sqlite instead of SQLite WASM.
function bunSql(d: Database): Sql {
  return {
    all: <T>(q: string, p: Bind = []) => d.query(q).all(...(p as never[])) as T[],
    get: <T>(q: string, p: Bind = []) => (d.query(q).get(...(p as never[])) ?? undefined) as T | undefined,
    run: (q: string, p: Bind = []) => d.query(q).run(...(p as never[])).changes,
    exec: (s: string) => void d.exec(s),
  };
}

console.log("db: migrations");
{
  const fresh = () => {
    const d = new Database(":memory:");
    d.exec("PRAGMA foreign_keys = ON;");
    return d;
  };
  let d = fresh();
  let r = migrate(bunSql(d), schema, []);
  ok(r.from === 0 && r.to === 1, "a new file gets the schema (0 → 1)");
  ok(JSON.stringify(migrate(bunSql(d), schema, [])) === '{"from":1,"to":1}', "opening again changes nothing");
  const m2 = { version: 2, sql: "ALTER TABLE tags ADD COLUMN colour TEXT;" };
  const m3 = { version: 3, sql: "CREATE TABLE dev_extra (id INTEGER PRIMARY KEY) STRICT;" };
  r = migrate(bunSql(d), schema, [m3, m2]);
  ok(r.from === 1 && r.to === 3, "migrations run in order, whatever order they're listed (1 → 3)");
  ok(
    (d.query("SELECT count(*) AS n FROM pragma_table_info('tags') WHERE name = 'colour'").get() as { n: number }).n ===
      1,
    "migration 2 ran",
  );
  ok(
    refuses(d, "SELECT 1") === false && throwsMsg(() => migrate(bunSql(d), schema, [m2]), "newer version"),
    "a file from a newer Orbit is refused",
  );
  ok(
    throwsMsg(() => latestVersion([m3]), "without gaps"),
    "a gap in migration numbers is refused",
  );
  d = fresh();
  const bad = { version: 2, sql: "CREATE TABLE half (id INTEGER); THIS IS NOT SQL;" };
  ok(
    throwsMsg(() => migrate(bunSql(d), schema, [bad]), "syntax"),
    "a broken migration fails",
  );
  ok(
    (d.query("PRAGMA user_version").get() as { user_version: number }).user_version === 1 &&
      (d.query("SELECT count(*) AS n FROM sqlite_master WHERE name = 'half'").get() as { n: number }).n === 0,
    "…and is rolled back completely (still version 1, nothing half-made)",
  );
}

console.log("db: tables, codec and change tracking");
{
  const d = freshDb();
  const s = bunSql(d);
  const real = (
    d
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'questions_fts%' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[]
  ).map((r) => r.name);
  ok(JSON.stringify(real) === JSON.stringify([...TABLES].sort()), "TABLES lists exactly the schema's tables");

  // Every array / boolean field in types/tables/ is converted by the codec.
  const typesDir = join(import.meta.dir, "..", "types", "tables");
  const missing: string[] = [];
  for (const rel of new Bun.Glob("**/*.ts").scanSync(typesDir)) {
    const src = readFileSync(join(typesDir, rel), "utf8");
    const table = src.match(/^\/\/ Table `(\w+)`/m)?.[1] as TableName | undefined;
    if (!table) continue;
    for (const [, field, type] of src.matchAll(/^ {2}(\w+): ([^;]+);/gm)) {
      if (type.includes("[]") && !JSON_COLUMNS[table]?.includes(field)) missing.push(`${table}.${field} (array)`);
      if (/\bboolean\b/.test(type) && !BOOL_COLUMNS[table]?.includes(field))
        missing.push(`${table}.${field} (boolean)`);
    }
  }
  ok(
    missing.length === 0,
    "codec covers every array and boolean column" + (missing.length ? `: missing ${missing.join(", ")}` : ""),
  );
  const enc = encode("mock_attempt_items", { choice: [0, 2], visited: true, marked: false, typed: null });
  ok(
    enc.choice === "[0,2]" && enc.visited === 1 && enc.marked === 0 && enc.typed === null,
    "encode: arrays → JSON, booleans → 0/1",
  );
  const dec = decode<{ choice: number[] | null; visited: boolean }>("mock_attempt_items", { choice: null, visited: 1 });
  ok(dec.choice === null && dec.visited === true, "decode: JSON null stays null, 1 → true");

  const fx = readEffects(s);
  const hit = (w: string[], t: string) => affectedTables(w, fx).includes(t);
  ok(hit(["question_answers"], "question_stats"), "writing answers changes question_stats (trigger)");
  ok(hit(["question_answers"], "plan_day_progress"), "…and plan_day_progress (trigger → trigger)");
  ok(
    hit(["plans"], "plan_tasks") && hit(["plans"], "plan_day_progress"),
    "deleting plans reaches their tasks and progress (cascade)",
  );
  ok(hit(["mock_attempts"], "question_stats"), "deleting an attempt reaches question_stats (cascade → trigger)");
  ok(!hit(["tags"], "questions"), "unrelated tables are not marked changed");
}

console.log("db: named queries");
{
  const d = freshDb();
  const s = bunSql(d);
  const fx = readEffects(s);
  const runQ = <N extends keyof typeof QUERIES>(name: N, params?: unknown) => {
    const def = QUERIES[name] as unknown as QueryDef<unknown, unknown>;
    if (def.kind === "read") return { data: def.run(s, params), changed: [] as string[] };
    return { data: transaction(s, () => def.run(s, params)), changed: affectedTables(def.tables, fx) };
  };
  for (const [name, def] of Object.entries(QUERIES)) {
    const unknownTable = def.tables.find((t) => !(TABLES as readonly string[]).includes(t));
    ok(!unknownTable, `${name}: lists only real tables`);
  }
  ok(
    JSON.stringify(runQ("setup.status").data) === '{"hasPlan":false,"hasQuestions":false}',
    "setup.status: nothing loaded",
  );
  const first = runQ("dev.addSampleQuestion").data as string;
  const second = runQ("dev.addSampleQuestion").data as string;
  ok(first !== second, "two sample questions added in the same millisecond get different IDs");
  const latest = runQ("dev.latestQuestion").data as { question: { id: string }; mcq: { options: string[] } };
  ok(
    Array.isArray(latest.mcq.options) && latest.mcq.options.length === 4,
    "a read returns decoded rows (options is an array)",
  );
  const ans = runQ("dev.answerRandom");
  ok(
    ans.changed.includes("question_stats") && ans.changed.includes("question_answers"),
    "a write reports the tables its triggers changed",
  );
  const counts = runQ("db.counts").data as { table: string; rows: number }[];
  ok(
    counts.find((c) => c.table === "questions")?.rows === 2 &&
      counts.find((c) => c.table === "question_stats")?.rows === 1,
    "db.counts sees the writes",
  );
  let rolledBack = false;
  try {
    transaction(s, () => {
      s.run("INSERT INTO tags (name) VALUES ('kept?')");
      throw new Error("boom");
    });
  } catch {
    rolledBack = s.get<{ n: number }>("SELECT count(*) AS n FROM tags")!.n === 0;
  }
  ok(rolledBack, "a write that throws is rolled back completely");
  ok(
    JSON.stringify(runQ("setup.status").data) === '{"hasPlan":false,"hasQuestions":true}',
    "setup.status: questions, no plan",
  );
  const heroToday = "2026-11-20";
  runQ("dev.samplePlan", { today: heroToday });
  runQ("dev.samplePlan", { today: heroToday }); // loading it twice replaces it
  const hero = runQ("dashboard.hero", { today: heroToday }).data as {
    headline: { kind: string; days?: number };
    ticks: { state: string }[];
    flags: unknown[];
    todayTasks: { done: number; total: number } | null;
  };
  ok(
    hero.headline.kind === "in" && hero.headline.days === 15,
    "dashboard.hero: counts down to the sample's next milestone",
  );
  ok(
    hero.flags.length === 4 && hero.ticks.some((t) => t.state === "done") && hero.ticks.some((t) => t.state === "miss"),
    "…with flags, done and missed days",
  );
  ok(JSON.stringify(hero.todayTasks) === '{"done":1,"total":4}', "…and today's tasks (1 of 4)");
  ok((runQ("setup.status").data as { hasPlan: boolean }).hasPlan, "setup.status: the sample plan counts as a plan");
  runQ("dev.clearAll");
  ok(
    (runQ("db.counts").data as { rows: number }[]).every((c) => c.rows === 0),
    "dev.clearAll empties every table",
  );
  ok(d.query("PRAGMA foreign_key_check").all().length === 0, "no foreign key violations after clearing");
}

console.log("markdown: inline");
{
  const j = (s: string) => JSON.stringify(parseInline(s));
  const J = (v: unknown) => JSON.stringify(v);
  ok(j("plain") === J([{ t: "text", v: "plain" }]), "plain text");
  ok(
    j("a $x^2$ b") ===
      J([
        { t: "text", v: "a " },
        { t: "math", v: "x^2", display: false },
        { t: "text", v: " b" },
      ]),
    "inline maths",
  );
  ok(j("$$\\int_0^1 x$$") === J([{ t: "math", v: "\\int_0^1 x", display: true }]), "display maths inline");
  ok(j("costs \\$5") === J([{ t: "text", v: "costs $5" }]), "escaped dollar");
  ok(j("one $ alone") === J([{ t: "text", v: "one $ alone" }]), "unclosed $ stays text");
  ok(j("$\\$x$") === J([{ t: "math", v: "\\$x", display: false }]), "escaped $ inside maths");
  ok(
    j("**b** *i* ++u++ ~~s~~") ===
      J([
        { t: "strong", c: [{ t: "text", v: "b" }] },
        { t: "text", v: " " },
        { t: "em", c: [{ t: "text", v: "i" }] },
        { t: "text", v: " " },
        { t: "u", c: [{ t: "text", v: "u" }] },
        { t: "text", v: " " },
        { t: "del", c: [{ t: "text", v: "s" }] },
      ]),
    "bold, italic, underline, strike",
  );
  ok(
    j("*a **b** c*") ===
      J([
        {
          t: "em",
          c: [
            { t: "text", v: "a " },
            { t: "strong", c: [{ t: "text", v: "b" }] },
            { t: "text", v: " c" },
          ],
        },
      ]),
    "bold nested in italic",
  );
  ok(j("2 * 3 * 4") === J([{ t: "text", v: "2 * 3 * 4" }]), "spaced asterisks stay text");
  ok(j("snake_case_name") === J([{ t: "text", v: "snake_case_name" }]), "underscores inside words stay text");
  ok(j("`a*b*c`") === J([{ t: "code", v: "a*b*c" }]), "code span is literal");
  ok(
    j("[site](https://x.org)") === J([{ t: "link", href: "https://x.org", c: [{ t: "text", v: "site" }] }]),
    "safe link",
  );
  ok(
    j("[bad](javascript:alert(1))").includes('"t":"text"') && !j("[bad](javascript:alert(1))").includes('"link"'),
    "unsafe link stays text",
  );
  ok(j("![g](img:h12ab)") === J([{ t: "img", src: "img:h12ab", alt: "g" }]), "image reference");
  ok(!j("![x](data:image/png;base64,AAA)").includes('"img"'), "base64 image refused");
  ok(j("<b>hi</b>") === J([{ t: "text", v: "<b>hi</b>" }]), "raw HTML stays text");
  ok(j("a\nb") === J([{ t: "text", v: "a" }, { t: "br" }, { t: "text", v: "b" }]), "line break");
  ok(
    j("Linear algebra (2026)") === J([{ t: "text", v: "Linear algebra (2026)" }]) && j("") === "[]",
    "plain text fast path",
  );
  ok(
    j("a\\*b") === J([{ t: "text", v: "a*b" }]) && j("x+y") === J([{ t: "text", v: "x+y" }]),
    "fast path still sees \\ and +",
  );
}

console.log("markdown: blocks");
{
  const kinds = (s: string) =>
    parseMarkdown(s)
      .map((b) => b.t)
      .join(",");
  ok(kinds("# Title\n\nText") === "h,p", "heading + paragraph");
  ok(kinds("- a\n- b\n\n1. x\n2. y") === "ul,ol", "bullet and numbered lists");
  ok(kinds("> quoted\n> more") === "quote", "quote");
  ok(kinds("```py\nx = 1\n```") === "code", "fenced code");
  ok(kinds("Evaluate:\n$$\n\\int x\\,dx\n$$\nDone") === "p,math,p", "multi-line display maths");
  ok(kinds("$$x^2$$") === "math", "one-line display maths");
  ok(kinds("---") === "hr", "divider");
  const ol = parseMarkdown("3. c\n4. d")[0];
  ok(ol.t === "ol" && ol.start === 3 && ol.items.length === 2, "numbered list keeps its start");
  const code = parseMarkdown("```\n**not bold**\n```")[0];
  ok(code.t === "code" && code.v === "**not bold**", "code block is literal");
}

console.log("editing");
{
  const run = (text: string, e: Edit) => ({
    out: applyEdit(text, e),
    sel: applyEdit(text, e).slice(e.selStart, e.selEnd),
  });
  let r = run("make this bold", wrap("make this bold", 5, 9, "**", "**", "bold text"));
  ok(r.out === "make **this** bold" && r.sel === "this", "wrap selection");
  r = run("make **this** bold", wrap("make **this** bold", 7, 11, "**", "**", "bold text"));
  ok(r.out === "make this bold" && r.sel === "this", "wrap again unwraps");
  r = run("ab", wrap("ab", 1, 1, "*", "*", "italic"));
  ok(r.out === "a*italic*b" && r.sel === "italic", "empty selection inserts a selected placeholder");
  r = run("one\ntwo", toggleLines("one\ntwo", 0, 7, "bullet"));
  ok(r.out === "- one\n- two", "bullet every selected line");
  r = run("- one\n- two", toggleLines("- one\n- two", 0, 11, "bullet"));
  ok(r.out === "one\ntwo", "bullet again removes");
  r = run("a\nb\nc", toggleLines("a\nb\nc", 0, 5, "numbered"));
  ok(r.out === "1. a\n2. b\n3. c", "numbered lines");
  r = run("x", toggleLines("x", 1, 1, "heading"));
  ok(r.out === "## x", "heading on the current line");
  r = run("text", insertBlock("text", 4, 4, "$$\n", "\n$$", "x^2"));
  ok(r.out === "text\n$$\nx^2\n$$" && r.sel === "x^2", "display maths goes on its own lines");
  ok(
    applyEdit("ab", replaceWithBlock("ab", 1, 1, "$$\nx\n$$")) === "a\n$$\nx\n$$\nb",
    "finished block lands on its own lines",
  );
  ok(
    applyEdit("a\nb", replaceWithBlock("a\nb", 2, 2, "---")) === "a\n---\nb",
    "no extra blank lines when already on a new line",
  );
}

console.log("code indentation");
{
  const run = (t: string, e: Edit | null) =>
    e ? { out: applyEdit(t, e), cur: e.selStart, sel: applyEdit(t, e).slice(e.selStart, e.selEnd) } : null;
  let t = "def f(x):";
  let r = run(t, cIndent.newline(t, t.length, t.length, "python"))!;
  ok(r.out === "def f(x):\n    " && r.cur === r.out.length, "python: Enter after : indents 4");
  t = "    x = 1";
  r = run(t, cIndent.newline(t, t.length, t.length, "python"))!;
  ok(r.out === "    x = 1\n    ", "Enter keeps the current indent");
  t = "if (a) {}";
  r = run(t, cIndent.newline(t, 8, 8, "c"))!;
  ok(r.out === "if (a) {\n    \n}" && r.cur === 13, "Enter between {} puts } on its own line");
  t = "a";
  r = run(t, cIndent.indent(t, 1, 1, "python", 1))!;
  ok(r.out === "a   " && r.cur === 4, "Tab goes to the next indent stop");
  t = "a\nb\n";
  r = run(t, cIndent.indent(t, 0, 4, "javascript", 1))!;
  ok(r.out === "  a\n  b\n", "Tab indents every selected line (not the line after a trailing newline)");
  t = "    a\n  b";
  r = run(t, cIndent.indent(t, 0, t.length, "python", -1))!;
  ok(r.out === "a\nb", "Shift+Tab outdents, never past the margin");
  t = "      ";
  r = run(t, cIndent.backspace(t, 6, 6, "python"))!;
  ok(r.out === "    ", "Backspace in leading spaces goes back to the previous stop");
  ok(cIndent.backspace("ab", 2, 2, "python") === null, "Backspace after text is normal");
  t = "{\n    ";
  r = run(t, cIndent.typeCloser(t, t.length, t.length, "}", "c"))!;
  ok(r.out === "{\n}", "typing } on a blank indented line outdents it");
  ok(
    JSON.stringify(cIndent.indentLevels("a:\n    b\n\n    c\nd", 4)) === "[0,1,1,1,0]",
    "indent levels, blank line inside a block keeps the guide",
  );
  ok(cIndent.leadingWidth("\t  x", 4) === 6, "a tab counts as one level");
}

console.log("dates");
{
  ok(
    todayIST(Date.UTC(2026, 10, 17, 18, 29)) === "2026-11-17" &&
      todayIST(Date.UTC(2026, 10, 17, 18, 30)) === "2026-11-18",
    "todayIST flips at IST midnight",
  );
  ok(
    isIsoDate("2028-02-29") && !isIsoDate("2027-02-29") && !isIsoDate("2026-13-01") && !isIsoDate("18/11/2026"),
    "isIsoDate",
  );
  ok(
    addDays("2026-12-31", 1) === "2027-01-01" && addDays("2026-03-01", -1) === "2026-02-28",
    "addDays across month and year",
  );
  ok(
    addMonths("2026-01-31", 1) === "2026-02-28" && addMonths("2026-11-15", -12) === "2025-11-15",
    "addMonths clamps to month end",
  );
  ok(weekday("2026-11-16") === 0 && weekday("2026-11-22") === 6, "weekday: Monday = 0, Sunday = 6");
  const grid = monthGrid(2026, 11);
  ok(
    grid.length === 42 && grid[0].date === "2026-10-26" && grid.filter((c) => c.inMonth).length === 30,
    "month grid starts on a Monday",
  );
  ok(formatDate("2026-11-18") === "Wed, 18 Nov 2026", "formatDate");
  ok(daysInMonth(2000, 2) === 29 && daysInMonth(1900, 2) === 28, "leap years");
}

console.log("images");
{
  const a = await hashImage(new TextEncoder().encode("picture"));
  const b = await hashImage(new TextEncoder().encode("picture"));
  const c = await hashImage(new TextEncoder().encode("other"));
  ok(a === b && a !== c && /^h[0-9a-f]{32}$/.test(a), "same bytes → same name, different bytes → different name");
  ok(refToHash(imageRef(a)) === a && refToHash("https://x") === null, "img:<hash> round trip");
  ok(
    imageProblem({ type: "text/plain", size: 10 }) !== null &&
      imageProblem({ type: "image/png", size: 6e6 }) !== null &&
      imageProblem({ type: "image/png", size: 1000 }) === null,
    "file checks: type and 5 MB limit",
  );
}

console.log("plan file (lib/planFile.ts) and its AI prompt");
{
  const base = { format: "orbit-plan", version: 1, name: "P" };
  const parse = (o: unknown) => parsePlanFile(typeof o === "string" ? o : JSON.stringify(o));
  const r1 = parse({
    ...base,
    milestones: [{ name: "Exam", date: "2026-12-10" }],
    days: [
      { from: "2026-11-30", to: "2026-12-06", weekdays: ["mon", "wed"], title: "Range", tasks: ["a", "b"] },
      { date: "2026-12-02", title: "Single wins", kind: "exam", hours: 1.5 },
      { from: "2026-12-07", to: "2026-12-08", title: "Later range", questions: ["q1", "q1", "q2"] },
    ],
  });
  ok(r1.plan !== null && r1.errors.length === 0, "a valid file is accepted");
  ok(
    JSON.stringify(r1.plan!.days.map((d) => d.date)) === '["2026-11-30","2026-12-02","2026-12-07","2026-12-08"]',
    "ranges expand, weekdays filter (mon, wed)",
  );
  ok(
    r1.plan!.days[1].title === "Single wins" && r1.plan!.days[1].kind === "exam" && r1.plan!.days[1].hours === 1.5,
    "a single date beats a range",
  );
  ok(
    r1.plan!.starts_on === "2026-11-30" && r1.plan!.ends_on === "2026-12-08",
    "plan dates default to the first / last day",
  );
  ok(
    JSON.stringify(r1.plan!.days[2].questions) === '["q1","q2"]' && r1.plan!.days[0].kind === "study",
    "question ids deduped; kind defaults to study",
  );
  const bad = parse({
    format: "something-else",
    days: [
      { date: "2026-02-30", title: "x" },
      { from: "2026-12-05", to: "2026-12-01", title: "x" },
      { date: "2026-12-01" },
      { date: "2026-12-01", title: "x", kind: "party" },
      { from: "2026-12-01", to: "2026-12-03", weekdays: ["funday"], title: "x" },
      { date: "2026-12-04", weekdays: ["mon"], title: "x" },
      { date: "2026-12-05", title: "x", tasks: Array(21).fill("t") },
    ],
  });
  ok(bad.plan === null && bad.errors.length >= 8, "a bad file is refused with one message per problem");
  ok(
    bad.errors.some((e) => e.includes('"name"')) &&
      bad.errors.some((e) => e.includes("2026-02-30")) &&
      bad.errors.some((e) => e.includes("party")),
    "…messages name the field and the value",
  );
  ok(
    parse({
      ...base,
      days: [
        { date: "2026-12-01", title: "a" },
        { date: "2026-12-01", title: "b" },
      ],
    }).errors.some((e) => e.includes("already planned")),
    "the same single date twice is refused",
  );
  ok(
    parse({ ...base, starts_on: "2026-12-05", days: [{ date: "2026-12-01", title: "a" }] }).errors.some((e) =>
      e.includes("outside"),
    ),
    "a day outside starts_on…ends_on is refused",
  );
  ok(
    parse("not json").errors[0].includes("valid JSON") && parse("[1]").plan === null,
    "not JSON / not an object is refused",
  );
  const fenced = "```json\n" + JSON.stringify({ ...base, days: [{ date: "2026-12-01", title: "a" }] }) + "\n```";
  ok(parse(fenced).plan !== null, "a file wrapped in ``` fences (as AI chats reply) is read");
  // JSON source with a correct "\\frac" and a broken single "\frac" (JSON reads that as a form feed + "rac")
  const broken = parse(
    '{"format":"orbit-plan","name":"P","days":[{"date":"2026-12-01","title":"ok $\\\\frac{a}{b}$, broken $\\frac{1}{2}$"}]}',
  );
  ok(
    broken.plan!.days[0].title === "ok $\\frac{a}{b}$, broken $\\frac{1}{2}$" &&
      broken.warnings.some((w) => w.includes("backslash")),
    "JSON-broken LaTeX backslashes are repaired, with a warning",
  );
  ok(
    parse({ name: "P", days: [{ date: "2026-12-01", title: "a" }] }).warnings.some((w) => w.includes('"format"')),
    "a missing format is only a warning",
  );
  const today = "2026-11-20";
  const ex = parsePlanFile(JSON.stringify(examplePlan(today)));
  ok(
    ex.plan !== null && ex.errors.length === 0 && ex.warnings.length === 0,
    "the prompt's example passes the importer with no warnings",
  );
  const prompt = planPrompt(today);
  ok(
    prompt.includes(JSON.stringify(examplePlan(today), null, 2)) && prompt.includes(today),
    "the prompt contains the example and today's date",
  );
  ok(!/\b(GATE|JEE|NEET|UPSC|SAT|GRE)\b/.test(prompt), "the prompt names no particular exam");
  const s = planSummary(ex.plan!);
  ok(s.milestones === 2 && s.days > 15 && s.tasks > 30, "planSummary counts days, tasks and milestones");

  // the import query, against the real schema
  const d = freshDb();
  const s2 = bunSql(d);
  const imp = (text: string) =>
    transaction(s2, () => (QUERIES["plan.import"] as unknown as QueryDef<unknown, unknown>).run(s2, { text })) as {
      ok: boolean;
      days?: number;
      tasks?: number;
      links?: number;
      warnings: string[];
      errors?: string[];
    };
  const before = (d.query("SELECT count(*) AS n FROM plans").get() as { n: number }).n;
  const no = imp(JSON.stringify({ format: "orbit-plan", days: [] }));
  ok(
    !no.ok && (d.query("SELECT count(*) AS n FROM plans").get() as { n: number }).n === before,
    "plan.import: a refused file writes nothing",
  );
  const yes = imp(JSON.stringify(examplePlan(today)));
  const rows = (t: string) => (d.query(`SELECT count(*) AS n FROM ${t}`).get() as { n: number }).n;
  ok(
    yes.ok &&
      rows("plans") === 1 &&
      rows("plan_days") === yes.days &&
      rows("plan_tasks") === yes.tasks &&
      rows("milestones") === 2,
    "plan.import: plan, days, tasks and milestones are written",
  );
  ok(rows("plan_day_progress") === yes.days, "…and day progress is set up by the triggers");
  const linked = imp(
    JSON.stringify({
      format: "orbit-plan",
      name: "Links",
      days: [{ date: "2026-12-01", title: "x", questions: ["nope"] }],
    }),
  );
  ok(
    linked.ok && linked.links === 0 && linked.warnings.some((w) => w.includes("aren't in your question bank")),
    "plan.import: unknown question ids are skipped with a warning",
  );
  ok(
    (d.query("SELECT count(*) AS n FROM plans WHERE is_active = 1").get() as { n: number }).n === 1,
    "plan.import: the new plan is the only active one",
  );
  ok(d.query("PRAGMA foreign_key_check").all().length === 0, "plan.import: no foreign key violations");
}

console.log("dashboard hero (lib/runway.ts)");
{
  const D = (
    on_date: string,
    status: "done" | "partial" | "incomplete" | null,
    tasks_done = 0,
    tasks_total = 2,
    kind: "study" | "exam" = "study",
  ) => ({ on_date, title: "T " + on_date, kind, status, tasks_done, tasks_total });
  const days = [
    D("2026-11-16", "done", 2),
    D("2026-11-17", "incomplete", 0),
    D("2026-11-18", "done", 2),
    D("2026-11-19", "partial", 2), // tasks done, a linked question still open
    D("2026-11-20", "partial", 1),
  ];
  ok(streak(days, "2026-11-20") === 0, "streak: a past partial day ends it");
  ok(
    streak([D("2026-11-18", "done", 2), D("2026-11-19", null), D("2026-11-20", "partial", 1)], "2026-11-20") === 1,
    "streak: rest days skipped, today not finished doesn't break it",
  );
  ok(
    streak([D("2026-11-19", "done", 2), D("2026-11-20", "done", 2)], "2026-11-20") === 2,
    "streak: today counts once done",
  );
  const ms = [
    { id: 1, name: "Quiz 1", on_date: "2026-11-15" },
    { id: 2, name: "Quiz 2", on_date: "2026-12-05" },
    { id: 3, name: "End Term", on_date: "2027-01-10" },
  ];
  const h = buildHero({
    today: "2026-11-20",
    plan: { starts_on: "2026-11-08", ends_on: "2027-02-07" },
    days,
    milestones: ms,
  });
  ok(
    JSON.stringify(h.headline) === '{"kind":"in","name":"Quiz 2","days":15}',
    "headline counts down to the next milestone",
  );
  ok(
    h.sub === "Day 13 of 92. 1 task left today. After that: End Term in 51 days.",
    "plan note + after that (v1 wording)",
  );
  ok(
    h.ticks[0].date === "2026-11-08" && h.ticks[h.ticks.length - 1].date === "2027-01-10",
    "track runs from the plan's start to the last milestone",
  );
  const st = (d: string) => h.ticks.find((t) => t.date === d)!.state;
  ok(
    st("2026-11-15") === "ms" && st("2026-11-20") === "today" && st("2026-11-21") === "future",
    "milestone, today and future ticks",
  );
  ok(
    st("2026-11-16") === "done" &&
      st("2026-11-17") === "miss" &&
      st("2026-11-19") === "past" &&
      st("2026-11-10") === "past",
    "past ticks: done green, missed red, tasks-done or unplanned plain",
  );
  ok(
    h.flags.find((f) => f.id === 2)!.next &&
      h.flags.find((f) => f.id === 1)!.long === "passed" &&
      h.flags.find((f) => f.id === 3)!.flip,
    "flags: next, passed, flipped at the right end",
  );
  ok(JSON.stringify(h.todayTasks) === '{"done":1,"total":2}', "today's tasks");
  ok(
    buildHero({ today: "2026-11-20", plan: null, days: [], milestones: [] }).headline.kind === "none",
    "no milestones: ask for one",
  );
  ok(
    buildHero({
      today: "2026-11-01",
      plan: { starts_on: "2026-11-03", ends_on: "2026-12-01" },
      days,
      milestones: [],
    }).sub.startsWith("Your plan starts in 2 days: T 2026-11-16."),
    "before the plan starts",
  );
  ok(
    buildHero({ today: "2027-03-01", plan: { starts_on: "2026-11-03", ends_on: "2026-12-01" }, days, milestones: ms })
      .headline.kind === "past",
    "every milestone behind you",
  );
  ok(daysBetween("2026-12-30", "2027-01-02") === 3, "daysBetween across a year");
}

console.log("quotes");
{
  let s = 3;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const order = shuffledOrder(QUOTES.length, rnd);
  ok(
    order.length === QUOTES.length && new Set(order).size === QUOTES.length,
    "a shuffle shows every quote exactly once",
  );
  ok(
    order.some((v, i) => v !== i),
    "…in a mixed-up order",
  );
  let clash = false;
  for (let k = 0; k < 200; k++) if (nextOrder(5, 2, rnd)[0] === 2) clash = true;
  ok(!clash, "the next round never starts with the quote just shown");
  ok(
    QUOTES.every((q) => q.trim().length > 0 && !/\bGATE\b/.test(q)),
    "quotes are non-empty and not exam-specific",
  );
  ok(formatLong("2026-11-20") === "Friday 20 November", "formatLong: v1's long date");
  ok(
    istHour(Date.UTC(2026, 10, 20, 20, 0)) === 1 && istHour(Date.UTC(2026, 10, 20, 6, 29)) === 11,
    "istHour: UTC+5:30",
  );
}

console.log("grading");
{
  ok(gradeMcq(1, 1) === "correct" && gradeMcq(1, 2) === "incorrect" && gradeMcq(1, null) === null, "mcq");
  ok(gradeMsq([0, 2], [2, 0]) === "correct", "msq: same set in any order is right");
  ok(gradeMsq([0, 2], [0]) === "incorrect" && gradeMsq([0, 2], [0, 1, 2]) === "incorrect", "msq: all-or-nothing");
  ok(gradeMsq([0], []) === null, "msq: nothing picked = unanswered");
  ok(
    parseNumber(" -2.5 ") === -2.5 && parseNumber(".5") === 0.5 && parseNumber("1e3") === 1000,
    "parseNumber accepts numbers",
  );
  ok(
    parseNumber("2,5") === null && parseNumber("abc") === null && parseNumber("") === null,
    "parseNumber rejects non-numbers",
  );
  ok(gradeNat(3.14, 0.01, "3.15") === "correct" && gradeNat(3.14, 0.01, "3.16") === "incorrect", "nat: tolerance");
  ok(
    gradeNat(2, 0, "2.0") === "correct" && gradeNat(2, 0, "x") === "incorrect" && gradeNat(2, 0, " ") === null,
    "nat: exact, junk, blank",
  );
  ok(
    gradeStr("exact", false, ["Binary Search"], "  binary   search ") === "correct",
    "str exact: case and spaces ignored",
  );
  ok(gradeStr("exact", true, ["Binary Search"], "binary search") === "incorrect", "str exact: case sensitive");
  ok(gradeStr("exact", false, ["colour", "color"], "Color") === "correct", "str: any accepted answer");
  ok(
    gradeStr("list", false, ["a, b, c"], "a,b,c") === "correct" &&
      gradeStr("list", false, ["a, b, c"], "c, b, a") === "incorrect",
    "str list: order matters",
  );
  ok(
    gradeStr("set", false, ["a, b, c"], "c, a, b") === "correct" &&
      gradeStr("set", false, ["a, b, c"], "a, b") === "incorrect",
    "str set: order ignored",
  );
  ok(
    marksFor("correct", 2, 0.67) === 2 && marksFor("incorrect", 2, 0.67) === -0.67 && marksFor(null, 2, 0.67) === 0,
    "marksFor",
  );
}

console.log("dashboard rules (lib/dashboard.ts)");
{
  ok(
    dayLock("2026-11-20", "2026-11-20", 8) === "open" &&
      dayLock("2026-11-20", "2026-11-20", 9) === "locked" &&
      dayLock("2026-11-19", "2026-11-20", 3) === "locked" &&
      dayLock("2026-11-21", "2026-11-20", 23) === "free",
    "day lock: today open before 9 AM, locked after; past locked; future free",
  );
  ok(
    focusDay("2026-11-20", "done", true) === "2026-11-21" &&
      focusDay("2026-11-20", "done", false) === "2026-11-20" &&
      focusDay("2026-11-20", "partial", true) === "2026-11-20",
    "focus moves to tomorrow only once today is done and tomorrow is planned",
  );
  ok(
    dayHeading("2026-11-20", "2026-11-20") === "Today" &&
      dayHeading("2026-11-21", "2026-11-20") === "Tomorrow" &&
      dayHeading("2026-11-23", "2026-11-20") === "Monday 23 November",
    "day heading",
  );
  const w = lastDays("2026-11-20", { "2026-11-20": 3, "2026-11-14": 1 });
  ok(
    w.length === 7 &&
      w[0].date === "2026-11-14" &&
      w[0].value === 1 &&
      w[0].letter === "S" &&
      w[6].today &&
      w[6].letter === "F" &&
      w[3].value === 0,
    "last 7 days: oldest first, missing days 0, weekday letters",
  );
  ok(
    dayTally(0, 0) === "Nothing done" &&
      dayTally(1, 0) === "1 task ticked" &&
      dayTally(0, 2) === "2 questions answered" &&
      dayTally(3, 1) === "3 tasks ticked · 1 question answered",
    "last 7 days: bar hover text",
  );
  ok(
    standingLine({ hasPlan: false, started: false, openTasks: 0 }) === "No plan loaded yet." &&
      standingLine({ hasPlan: true, started: false, openTasks: 0 }) === "Nothing is due yet." &&
      standingLine({ hasPlan: true, started: true, openTasks: 0 }) === "Everything due so far is done." &&
      standingLine({ hasPlan: true, started: true, openTasks: 1 }) === "1 due so far is still open." &&
      standingLine({ hasPlan: true, started: true, openTasks: 7 }) === "7 due so far are still open.",
    "where you stand: v1 wording",
  );
  ok(
    topicsLine({ topics: 0, fresh: 0, shaky: 0 }) === "" &&
      topicsLine({ topics: 40, fresh: 12, shaky: 1 }) === "Of 40 topics, 12 are new to you and 1 is shaky.",
    "topics line",
  );
  ok(formatShort("2026-11-08") === "8 Nov", "formatShort");
  const dp = dayHelpPrompt({
    date: "2026-11-20",
    kindLabel: "Study",
    hours: 1,
    title: "Limits",
    note: null,
    tasks: ["Read notes", "Solve 5"],
    topics: ["Calculus"],
    questions: 4,
  });
  const bare = dayHelpPrompt({
    date: "2026-11-20",
    kindLabel: "Rest",
    hours: null,
    title: null,
    note: null,
    tasks: [],
    topics: [],
    questions: 0,
  });
  ok(
    dp.includes("Friday 20 November (2026-11-20)") &&
      dp.includes("1 hour.") &&
      dp.includes("1. Read notes\n2. Solve 5") &&
      dp.includes("- Calculus") &&
      dp.includes("4 questions") &&
      bare.includes("(none)") &&
      !bare.includes("Time available") &&
      !bare.includes("TOPICS") &&
      !bare.includes("PRACTICE:"),
    "day help prompt: day, tasks, topics, practice; empty parts left out",
  );

  // the dashboard's read queries over the sample plan
  const d = freshDb();
  const s = bunSql(d);
  const q = <R>(name: keyof typeof QUERIES, params?: unknown) =>
    (QUERIES[name] as unknown as QueryDef<unknown, R>).run(s, params);
  const today = "2026-11-20";
  transaction(s, () => (QUERIES["dev.samplePlan"] as unknown as QueryDef<unknown, unknown>).run(s, { today }));
  const cal = q<{ days: { on_date: string; status: string | null }[]; milestones: unknown[] }>("dashboard.calendar");
  ok(cal.days.length > 70 && cal.milestones.length === 4, "dashboard.calendar: plan days and milestones");
  ok(cal.days.find((x) => x.on_date === "2026-11-19")?.status === "done", "dashboard.calendar: day status");
  const day = q<{ day: { kind: string } | null; tasks: { done: boolean }[]; upcoming: { on_date: string }[] }>(
    "dashboard.day",
    { date: today, today },
  );
  ok(
    day.day !== null && day.tasks.length === 4 && day.tasks[0].done && !day.tasks[1].done,
    "dashboard.day: tasks with ticks",
  );
  ok(
    day.upcoming.length === 4 && day.upcoming.every((u) => u.on_date > today),
    "dashboard.day: up to 4 days coming up after today",
  );
  const sunday = q<{ day: unknown; next: { on_date: string } | null }>("dashboard.day", { date: "2026-11-22", today });
  ok(sunday.day === null && sunday.next?.on_date === "2026-11-23", "dashboard.day: a rest day points at the next one");
  const st = q<{ hasPlan: boolean; started: boolean; tasksTotal: number; tasksDone: number; openTasks: number }>(
    "dashboard.standing",
    { today },
  );
  ok(
    st.hasPlan && st.started && st.tasksTotal > 0 && st.tasksDone > 0 && st.openTasks > 0,
    "dashboard.standing: counts plan tasks done and still open",
  );
  ok(q<unknown[]>("dashboard.milestones").length === 4, "dashboard.milestones");
  ok(
    q<unknown[]>("dashboard.mocks").length === 0 && q<unknown[]>("dashboard.weakest").length === 0,
    "mocks / weakest empty",
  );
  // ticking every task of today makes it "done"; unticking one makes it "partial" again; ticking twice is harmless
  const status = () =>
    q<{ days: { on_date: string; status: string | null }[] }>("dashboard.calendar").days.find(
      (x) => x.on_date === today,
    )?.status;
  const tick = (taskId: number, done: boolean) =>
    transaction(s, () => (QUERIES["plan.tickTask"] as unknown as QueryDef<unknown, unknown>).run(s, { taskId, done }));
  const ids = q<{ tasks: { id: number }[] }>("dashboard.day", { date: today, today }).tasks.map((t) => t.id);
  ok(status() === "partial", "plan.tickTask: today starts partial");
  for (const id of ids) tick(id, true);
  tick(ids[0], true);
  ok(status() === "done", "plan.tickTask: all ticked makes the day done (ticking twice is harmless)");
  tick(ids[1], false);
  const after = q<{ tasks: { done: boolean }[] }>("dashboard.day", { date: today, today }).tasks;
  ok(status() === "partial" && !after[1].done && after[0].done, "plan.tickTask: unticking makes it partial again");
  const week = q<Record<string, { tasks: number; questions: number }>>("dashboard.week", { today });
  ok(
    typeof week === "object" &&
      Object.values(week).every((c) => typeof c.tasks === "number" && typeof c.questions === "number"),
    "dashboard.week: tasks and questions per day",
  );
}

console.log("planner rules (lib/planner.ts)");
{
  const today = "2026-11-20"; // a Friday
  ok(
    windowDays(today, 0).join() === "2026-11-20,2026-11-21,2026-11-22" &&
      windowDays(today, -2).join() === "2026-11-18,2026-11-19,2026-11-20",
    "3-day window shifts with the offset",
  );
  const car = carouselDays(today, 0);
  ok(
    car.length === 5 &&
      car.find((c) => c.pos === 0)?.date === today &&
      car.find((c) => c.pos === -1)?.date === "2026-11-19" &&
      car.find((c) => c.pos === 1)?.date === "2026-11-21" &&
      carouselDays(today, 3).find((c) => c.pos === 0)?.date === "2026-11-23",
    "carousel: today in the middle, a day either side, the centre moves with the offset",
  );
  ok(
    cardLabel(today, today) === "Today" &&
      cardLabel("2026-11-21", today) === "Tomorrow" &&
      cardLabel("2026-11-19", today) === "Yesterday" &&
      cardLabel("2026-11-23", today) === "Monday",
    "card labels",
  );
  const day = (
    on_date: string,
    status: PlannerDay["status"],
    done = 0,
    total = 4,
    kind: PlannerDay["kind"] = "study",
  ) =>
    ({
      on_date,
      title: null,
      kind,
      hours: null,
      status,
      tasks_total: total,
      tasks_done: done,
      questions_total: 0,
      questions_done: 0,
    }) satisfies PlannerDay;
  ok(
    dayState(day("2026-11-18", "done", 4), today) === "won" &&
      dayState(day("2026-11-18", "partial", 2), today) === "missed" &&
      dayState(day("2026-11-18", "incomplete", 0, 4, "exam"), today) === "pending" &&
      dayState(day(today, "partial", 1), today) === "partial" &&
      dayState(day("2026-11-25", "incomplete"), today) === "pending" &&
      dayState(day("2026-11-25", null, 0, 0), today) === "rest",
    "day states: won, missed (past, not exam), partial, pending, rest",
  );
  ok(
    dayCount(day(today, "partial", 2)) === "2/4" &&
      dayCount(day(today, "done", 4)) === "✓" &&
      dayCount(day(today, null, 0, 0)) === "",
    "row counts",
  );
  const days = [
    day("2026-10-30", "done", 4),
    day("2026-10-31", "incomplete"),
    day("2026-11-02", "partial", 1),
    day("2026-11-20", "partial", 3),
    day("2026-12-01", "incomplete", 0, 4, "exam"),
  ];
  ok(
    missedDays(days, today)
      .map((d) => d.on_date)
      .join() === "2026-10-31,2026-11-02",
    "missed: past days left unfinished",
  );
  const months = groupByMonth(days, today);
  ok(
    months.map((m) => m.label).join() === "October 2026,November 2026,December 2026" &&
      months[1].current &&
      !months[0].current &&
      months[1].from === "2026-11-02" &&
      months[1].to === "2026-11-20" &&
      months[1].weeks.map((w) => w.label).join() === "Week of 2 Nov,Week of 16 Nov" &&
      months[0].weeks.length === 1 &&
      months[0].weeks[0].start === "2026-10-26",
    "full plan: months, the current one open, weeks starting Monday",
  );
  ok(groupByMonth(days, "2026-01-01")[0].current, "full plan: before the plan starts, the first month is open");
  const seg = stripSegments(days, today);
  ok(
    seg.length === 4 &&
      seg.map((s) => s.state).join() === "won,missed,missed,partial" &&
      seg[3].part === 0.75 &&
      seg[0].weight === 4 &&
      stripLabel(seg) === "1 of 4 days done, 2 missed",
    "month strip: exam days left out, states, part done, label",
  );
  const span = { starts_on: "2026-11-02", ends_on: "2026-12-01" };
  ok(
    emptyDayNote("2026-11-01", span) === "Your plan starts on Mon, 2 Nov 2026." &&
      emptyDayNote("2026-12-02", span) === "The plan has ended." &&
      emptyDayNote("2026-11-22", span) === "",
    "empty day note",
  );

  // the planner's queries over the sample plan
  const d = freshDb();
  const s = bunSql(d);
  const run = <R>(name: keyof typeof QUERIES, params?: unknown) =>
    transaction(s, () => (QUERIES[name] as unknown as QueryDef<unknown, R>).run(s, params));
  ok(run("planner.days") === null, "planner.days: null without a plan");
  run("dev.samplePlan", { today });
  const pd = run<{ plan: { name: string }; days: PlannerDay[] }>("planner.days")!;
  ok(
    pd.plan.name === "Sample plan" &&
      pd.days.length > 70 &&
      pd.days.every((x, i) => i === 0 || pd.days[i - 1].on_date < x.on_date) &&
      pd.days.find((x) => x.on_date === today)?.tasks_done === 1,
    "planner.days: every day in order, with progress counts",
  );
  ok(missedDays(pd.days, today).length > 0, "planner.days: the sample plan has missed days");
  const todayDay = run<{ day: { id: number } }>("dashboard.day", { date: today, today }).day.id;
  const statusOf = () => run<{ days: PlannerDay[] }>("planner.days").days.find((x) => x.on_date === today)?.status;
  run("plan.tickDay", { dayId: todayDay, done: true });
  run("plan.tickDay", { dayId: todayDay, done: true });
  ok(statusOf() === "done", "plan.tickDay: ticks every task (twice is harmless)");
  run("plan.tickDay", { dayId: todayDay, done: false });
  ok(statusOf() === "incomplete", "plan.tickDay: unticks every task");
}

if (failed) {
  console.log(`\n${failed} FAILED`);
  process.exit(1);
}
console.log("\nALL OK");
