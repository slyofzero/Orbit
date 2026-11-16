// Logic test suite. Must print "ALL OK". Run: bun run check
// Uses bun's built-in SQLite to verify db/schema.sql; the app itself uses the WASM build in a worker.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let failed = 0;
function ok(cond: unknown, label: string) {
  if (cond) console.log("  ok   " + label);
  else { failed++; console.log("  FAIL " + label); }
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
try { db = freshDb(); ok(true, "db/schema.sql loads"); }
catch (e) { ok(false, "db/schema.sql loads: " + String(e)); process.exit(1); }
ok((db.query("PRAGMA user_version").get() as { user_version: number }).user_version === 1, "user_version = 1");
ok(db.query("PRAGMA foreign_key_check").all().length === 0, "no foreign key violations");
const tables = db.query("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'").get() as { n: number };
ok(tables.n > 10, `tables created (${tables.n})`);

// ---------------------------------------------------------------------------
// Fixtures
function seed(db: Database, nQuestions: number) {
  db.exec("INSERT INTO subjects(id, name) VALUES ('s', 'Subject')");
  db.exec("INSERT INTO topics(id, subject_id, name) VALUES ('tp_1', 's', 'Topic')");
  const ins = db.prepare(`INSERT INTO questions(id, topic_id, type, marks, difficulty, stem, content_hash, created_at, updated_at)
                          VALUES (?, 'tp_1', 'mcq', 1, 'easy', ?, ?, 0, 0)`);
  for (let i = 0; i < nQuestions; i++) ins.run(`q_${i}`, `word${i} common stem`, `h${i}`);
}

// ---------------------------------------------------------------------------
console.log("search index survives VACUUM");
{
  const f = new Database(join(process.env.TEMP ?? "/tmp", `orbit-check-${process.pid}.sqlite3`));
  try {
    f.exec("PRAGMA foreign_keys = ON;"); f.exec(schema);
    seed(f, 6);
    f.exec("DELETE FROM questions WHERE id IN ('q_0', 'q_2')");   // leave gaps that VACUUM could close
    f.exec("VACUUM");
    const hit = f.query(`SELECT q.id FROM questions_fts JOIN questions q ON q.n = questions_fts.rowid
                         WHERE questions_fts MATCH 'word4'`).all() as { id: string }[];
    ok(hit.length === 1 && hit[0].id === "q_4", "search finds the right question after VACUUM");
    f.exec("INSERT INTO questions_fts(questions_fts) VALUES ('integrity-check')");
    ok(true, "FTS integrity-check passes");
  } catch (e) { ok(false, "search index: " + String(e)); }
  finally { f.close(); }
}

// ---------------------------------------------------------------------------
console.log("question_stats triggers = full rebuild");
{
  const REBUILD = `
    SELECT question_id, COUNT(*) AS answers, SUM(outcome = 'right') AS rights,
           coalesce(MIN(CASE WHEN outcome = 'wrong' THEN rn END) - 1, COUNT(*)) AS streak,
           MAX(CASE WHEN rn = 1 THEN outcome END) AS last_outcome, MAX(at) AS last_at, SUM(ms) AS total_ms
    FROM (SELECT question_id, outcome, at, coalesce(ms, 0) AS ms,
                 ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY at DESC) AS rn
          FROM v_answers WHERE outcome IN ('right', 'wrong'))
    GROUP BY question_id ORDER BY question_id`;
  const CACHED = `SELECT question_id, answers, rights, streak, last_outcome, last_at, total_ms
                  FROM question_stats ORDER BY question_id`;
  const same = (label: string) =>
    ok(JSON.stringify(db.query(CACHED).all()) === JSON.stringify(db.query(REBUILD).all()), label);

  db = freshDb();
  seed(db, 20);
  // Deterministic pseudo-random answers with distinct times, inserted OUT of time order.
  let s = 7;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const ev = db.prepare(`INSERT INTO practice_events(question_id, question_rev, shown_at, answered_at, outcome, ms)
                         VALUES (?, 1, ?, ?, ?, ?)`);
  const times = Array.from({ length: 400 }, (_, i) => 1_000_000 + i * 1000).sort(() => rnd() - 0.5);
  for (const t of times) {
    const q = `q_${Math.floor(rnd() * 20)}`;
    if (rnd() < 0.15) ev.run(q, t, null, null, null);                 // skip
    else ev.run(q, t, t + 500, rnd() < 0.6 ? "right" : "wrong", 500);
  }
  same("after 400 practice answers inserted out of order");

  db.exec("UPDATE practice_events SET answered_at = shown_at + 10, outcome = 'right', ms = 10 WHERE outcome IS NULL AND id % 2 = 0");
  same("after answering shown (skipped) rows");

  db.exec("UPDATE practice_events SET outcome = CASE outcome WHEN 'right' THEN 'wrong' ELSE 'right' END WHERE id % 7 = 0 AND outcome IS NOT NULL");
  same("after correcting some outcomes");

  db.exec("DELETE FROM practice_events WHERE id % 5 = 0");
  same("after deleting some practice answers");

  // Two mocks: one scored, one later marked failed, then the scored one deleted.
  for (const [aid, at] of [["at_1", 1_200_500], ["at_2", 1_300_500]] as const) {
    db.exec(`INSERT INTO attempts(id, title, created_at, started_at, duration_sec) VALUES ('${aid}', 'Mock', 0, 0, 3600)`);
    db.exec(`INSERT INTO attempt_sections(attempt_id, position, name) VALUES ('${aid}', 0, 'S')`);
    for (let i = 0; i < 10; i++)
      db.exec(`INSERT INTO attempt_items(attempt_id, question_id, position, section_pos, question_rev, ms)
               VALUES ('${aid}', 'q_${i}', ${i}, 0, 1, 1000)`);
    db.exec(`UPDATE attempts SET submitted_at = ${at} WHERE id = '${aid}'`);
    db.exec(`UPDATE attempt_items SET outcome = CASE WHEN position % 3 = 0 THEN 'wrong' WHEN position % 3 = 1 THEN 'right' ELSE 'skip' END
             WHERE attempt_id = '${aid}'`);
  }
  same("after scoring two mocks");

  db.exec("UPDATE attempts SET failed_reason = 'left full screen' WHERE id = 'at_2'");
  same("after marking a mock failed");

  db.exec("DELETE FROM attempts WHERE id = 'at_1'");
  ok((db.query("SELECT count(*) AS n FROM attempt_items WHERE attempt_id = 'at_1'").get() as { n: number }).n === 0,
     "deleting an attempt cascades to its items");
  same("after deleting a whole attempt");

  let blocked = false;
  db.exec(`INSERT INTO attempts(id, title, created_at, duration_sec) VALUES ('at_3', 'Open', 0, 3600)`);
  db.exec(`INSERT INTO attempt_sections(attempt_id, position, name) VALUES ('at_3', 0, 'S')`);
  db.exec(`INSERT INTO attempt_items(attempt_id, question_id, position, section_pos, question_rev) VALUES ('at_3', 'q_1', 0, 0, 1)`);
  try { db.exec("UPDATE attempt_items SET outcome = 'right' WHERE attempt_id = 'at_3'"); } catch { blocked = true; }
  ok(blocked, "outcome on an unsubmitted attempt is refused");

  db.exec("DELETE FROM practice_events");
  db.exec("DELETE FROM attempts");
  ok((db.query("SELECT count(*) AS n FROM question_stats").get() as { n: number }).n === 0,
     "deleting every answer empties question_stats");
}

if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log("\nALL OK");
