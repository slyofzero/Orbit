// check.ts section: backup. Run: bun run check
import { Database } from "bun:sqlite";
import { examplePlan } from "@/lib/prompts/planPrompt";
import { exampleQuestions } from "@/lib/prompts/questionsPrompt";
import { BACKUP_ORDER, DERIVED_TABLES, b64decode, b64encode, parseBackup } from "@/lib/backup";
import { QUERIES, type QueryDef } from "@/lib/db/queries";
import { TABLES, transaction, type Sql } from "@/lib/db/sql";
import { ok, freshDb, bunSql } from "@/scripts/checks/helpers";

console.log("backup, restore and start fresh (lib/backup.ts)");
{
  // pure rules
  const covered = new Set<string>([...BACKUP_ORDER, ...DERIVED_TABLES]);
  ok(
    covered.size === BACKUP_ORDER.length + DERIVED_TABLES.length &&
      TABLES.every((t) => covered.has(t)) &&
      covered.size === TABLES.length,
    "every table is either backed up or a cache (so a new table can't be forgotten)",
  );
  const bytes = new Uint8Array(70000).map((_, i) => (i * 7) % 256);
  ok(
    b64decode(b64encode(bytes)).every((b, i) => b === bytes[i]) && b64decode(b64encode(bytes)).length === 70000,
    "pictures survive text and back (even large ones)",
  );
  ok(parseBackup("nope").backup === null, "a backup that isn't JSON is refused");
  ok(
    parseBackup(JSON.stringify({ format: "orbit-plan" })).errors[0].includes("isn't an Orbit backup"),
    "a plan file is not mistaken for a backup",
  );
  const mk = (o: object) =>
    JSON.stringify({ format: "orbit-backup", version: 1, schema_version: 1, exported_at: 1, tables: {}, ...o });
  ok(
    parseBackup(mk({ schema_version: 2 }), 1).errors[0].includes("newer"),
    "a backup from a newer database version is refused",
  );
  ok(
    parseBackup(mk({ tables: { secrets: [] } }), 1).errors[0].includes("doesn't know"),
    "a table Orbit doesn't know is refused",
  );
  ok(
    parseBackup(mk({ tables: { subjects: [{ "name; DROP TABLE x": "a" }] } }), 1).backup === null,
    "odd column names are refused",
  );
  ok(parseBackup(mk({ tables: { subjects: [{ id: { nested: 1 } }] } }), 1).backup === null, "odd values are refused");
  ok(parseBackup(mk({}), 1).backup !== null, "an empty backup is fine");

  // a database with a bit of everything
  const a = freshDb();
  const sa = bunSql(a);
  const run = (db: Database, s: Sql, name: string, params?: unknown) =>
    transaction(s, () =>
      (QUERIES[name as keyof typeof QUERIES] as unknown as QueryDef<unknown, unknown>).run(s, params),
    ) as Record<string, unknown>;
  const count = (db: Database, t: string) => (db.query(`SELECT count(*) AS n FROM ${t}`).get() as { n: number }).n;
  run(a, sa, "pack.import", { text: JSON.stringify(exampleQuestions("topics")), fileName: "a.json", fileHash: "h1" });
  run(a, sa, "pack.import", { text: JSON.stringify(exampleQuestions("mocks")), fileName: "b.json", fileHash: "h2" });
  run(a, sa, "pack.import", {
    text: JSON.stringify(exampleQuestions("programming")),
    fileName: "c.json",
    fileHash: "h3",
  });
  const qids = (
    a.query("SELECT id FROM questions WHERE pool = 'practice' ORDER BY id LIMIT 2").all() as { id: string }[]
  ).map((r) => r.id);
  const plan = examplePlan("2026-11-20") as { days: { questions?: string[] }[] };
  plan.days[0].questions = qids;
  ok(
    (run(a, sa, "plan.import", { text: JSON.stringify(plan) }) as { ok: boolean }).ok,
    "setup: a plan linking two questions",
  );
  const T = Date.parse("2026-12-30T10:00:00Z");
  a.exec(
    `INSERT INTO question_answers (question_id, recorded_at, outcome, time_ms) VALUES ('${qids[0]}', ${T}, 'correct', 5000), ('${qids[1]}', ${T}, 'incorrect', 7000)`,
  );
  const mockId = (a.query("SELECT id FROM mocks LIMIT 1").get() as { id: string }).id;
  const mqs = (
    a.query("SELECT question_id FROM mock_items ORDER BY position LIMIT 2").all() as { question_id: string }[]
  ).map((r) => r.question_id);
  a.exec(`INSERT INTO mock_attempts (id, mock_id, status, sections, minutes, started_at, ended_at, score, max_score)
          VALUES ('at_1', '${mockId}', 'submitted', '[{"name":"s"}]', 30, ${T}, ${T + 1000}, 1, 2)`);
  a.exec(
    `INSERT INTO mock_attempt_items (attempt_id, question_id, section, position, visited) VALUES ('at_1', '${mqs[0]}', 0, 0, 1)`,
  );
  a.exec(
    `INSERT INTO question_answers (question_id, recorded_at, outcome, attempt_id) VALUES ('${mqs[0]}', ${T}, 'correct', 'at_1')`,
  );
  a.exec(`INSERT INTO plan_task_ticks (task_id, done_at) SELECT id, ${T} FROM plan_tasks LIMIT 3`);
  a.exec(`INSERT INTO topic_ratings (topic_id, rating, updated_at) SELECT id, 'shaky', ${T} FROM topics LIMIT 1`);
  a.exec(
    `INSERT INTO images (hash, mime, added_at, bytes) VALUES ('hpic', 'image/png', ${T}, X'89504E470D0A1A0A00FF')`,
  );
  ok(count(a, "plan_question_ticks") > 0, "setup: answering a linked question ticked its days");

  const exported = run(a, sa, "backup.export") as { text: string; questions: number; answers: number };
  ok(
    exported.questions === count(a, "questions") && exported.answers === 3,
    "backup.export: counts the questions and answers",
  );
  ok(
    !exported.text.includes('"question_stats"') && !exported.text.includes('"plan_day_progress"'),
    "…and leaves out the caches",
  );
  ok(
    parseBackup(exported.text, 1).summary?.plan === "Linear algebra in four weeks",
    "…and the file reads back, naming the plan",
  );

  // restore into a different database (one that already holds other data)
  const b = freshDb();
  const sb = bunSql(b);
  run(b, sb, "pack.import", {
    text: JSON.stringify({ ...(exampleQuestions("topics") as object), name: "Other" }),
    fileName: "x.json",
    fileHash: "zz",
  });
  const restored = run(b, sb, "backup.import", { text: exported.text }) as { ok: boolean };
  ok(restored.ok, "backup.import: a backup restores");
  const same = [...TABLES].filter((t) => count(a, t) !== count(b, t));
  ok(same.length === 0, `…every table has the same number of rows (differs: ${same.join(", ") || "none"})`);
  ok(
    JSON.stringify(a.query("SELECT * FROM question_stats ORDER BY question_id").all()) ===
      JSON.stringify(b.query("SELECT * FROM question_stats ORDER BY question_id").all()) &&
      JSON.stringify(a.query("SELECT * FROM plan_day_progress ORDER BY day_id").all()) ===
        JSON.stringify(b.query("SELECT * FROM plan_day_progress ORDER BY day_id").all()),
    "…the caches (stats and day progress) come out identical, rebuilt by the triggers",
  );
  ok(
    JSON.stringify(a.query("SELECT * FROM plan_question_ticks ORDER BY day_id, question_id").all()) ===
      JSON.stringify(b.query("SELECT * FROM plan_question_ticks ORDER BY day_id, question_id").all()),
    "…and the plan's question ticks are the same",
  );
  const pic = b.query("SELECT bytes FROM images WHERE hash = 'hpic'").get() as { bytes: Uint8Array };
  ok(
    pic.bytes.length === 10 && pic.bytes[0] === 0x89 && pic.bytes[9] === 0xff,
    "…and a picture comes back byte for byte",
  );
  ok(b.query("PRAGMA foreign_key_check").all().length === 0, "…with no foreign key violations");
  ok(count(b, "questions_fts") === count(b, "questions"), "…and the search index matches the questions");
  ok(
    count(b, "packs") === 3 &&
      (b.query("SELECT count(*) AS n FROM packs WHERE name = 'Other'").get() as { n: number }).n === 0,
    "…and what was there before is replaced, not mixed in",
  );

  // a refused or broken restore changes nothing
  const before = JSON.stringify(TABLES.map((t) => count(b, t)));
  const refused = run(b, sb, "backup.import", { text: "nope" }) as { ok: boolean };
  ok(
    !refused.ok && JSON.stringify(TABLES.map((t) => count(b, t))) === before,
    "backup.import: a file that isn't a backup changes nothing",
  );
  const oddCol = run(b, sb, "backup.import", {
    text: mk({ tables: { subjects: [{ id: "sb_1", name: "S", evil: 1 }] } }),
  }) as { ok: boolean; errors?: string[] };
  ok(
    !oddCol.ok && oddCol.errors![0].includes("evil") && JSON.stringify(TABLES.map((t) => count(b, t))) === before,
    "…and so does a file with an unknown column",
  );
  let threw = false;
  try {
    run(b, sb, "backup.import", {
      text: mk({
        tables: {
          subjects: [{ id: "sb_1", name: "S", position: 0, legacy_id: null }],
          topics: [{ id: "tp_1", subject_id: "sb_missing", name: "T" }],
        },
      }),
    });
  } catch {
    threw = true;
  }
  ok(
    threw && JSON.stringify(TABLES.map((t) => count(b, t))) === before,
    "…and a database error half-way rolls everything back",
  );

  // start fresh
  ok(run(b, sb, "app.startFresh") === (true as unknown as Record<string, unknown>), "app.startFresh: runs");
  ok(
    TABLES.every((t) => count(b, t) === 0) && count(b, "questions_fts") === 0,
    "…and every table, and the search index, is empty",
  );
  ok(b.query("PRAGMA foreign_key_check").all().length === 0, "…with no foreign key violations");
  const status = run(b, sb, "setup.status") as unknown as { hasPlan: boolean; hasQuestions: boolean };
  ok(!status.hasPlan && !status.hasQuestions, "…so the app sees no plan and no questions (→ /onboarding)");
}
