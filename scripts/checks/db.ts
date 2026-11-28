// check.ts section: db. Run: bun run check
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOOL_COLUMNS, JSON_COLUMNS, decode, encode } from "@/lib/db/codec";
import { affectedTables, readEffects } from "@/lib/db/effects";
import { latestVersion, migrate } from "@/lib/db/migrate";
import { QUERIES, type QueryDef } from "@/lib/db/queries";
import { TABLES, transaction, type TableName } from "@/lib/db/sql";
import { ok, freshDb, schema, throwsMsg, refuses, bunSql } from "@/scripts/checks/helpers";

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
  const typesDir = join(import.meta.dir, "..", "..", "types", "tables");
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
    JSON.stringify(runQ("setup.status").data) === '{"hasPlan":false,"hasQuestions":false,"skipped":false}',
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
    JSON.stringify(runQ("setup.status").data) === '{"hasPlan":false,"hasQuestions":true,"skipped":false}',
    "setup.status: questions, no plan",
  );
  runQ("settings.set", { key: "setup_skipped", value: "1" });
  ok((runQ("setup.status").data as { skipped: boolean }).skipped, "setup.status: Skip for now is remembered");
  runQ("settings.set", { key: "setup_skipped", value: "" });
  ok(!(runQ("setup.status").data as { skipped: boolean }).skipped, "setup.status: …and cleared");
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
