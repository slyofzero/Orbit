// check.ts section: schema. Run: bun run check
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ok, freshDb, schema, run, count, refuses, seed, at } from "@/scripts/checks/helpers";

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
  const typesDir = join(import.meta.dir, "..", "..", "types", "tables");
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
