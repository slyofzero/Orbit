// Logic test suite. Must print "ALL OK". Run: bun run check
// Uses bun's built-in SQLite to verify db/schema.sql; the app itself uses the WASM build in a worker.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseInline, parseMarkdown } from "@/lib/markdown";
import { applyEdit, insertBlock, replaceWithBlock, toggleLines, wrap, type Edit } from "@/lib/editing";
import { hashImage, imageProblem, imageRef, refToHash } from "@/lib/images";
import * as cIndent from "@/lib/codeIndent";
import { addDays, addMonths, daysInMonth, formatDate, isIsoDate, monthGrid, todayIST, weekday } from "@/lib/dates";
import { gradeMcq, gradeMsq, gradeNat, gradeStr, marksFor, parseNumber } from "@/lib/grade";

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
const tables = db.query("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'").get() as { n: number };
ok(tables.n > 10, `tables created (${tables.n})`);

// ---------------------------------------------------------------------------
// Fixtures
function seed(db: Database, nQuestions: number) {
  db.exec("INSERT INTO subjects(id, name) VALUES ('s', 'Subject')");
  db.exec("INSERT INTO topics(id, subject_id, name) VALUES ('tp_1', 's', 'Topic')");
  const ins =
    db.prepare(`INSERT INTO questions(id, topic_id, type, marks, difficulty, stem, content_hash, created_at, updated_at)
                          VALUES (?, 'tp_1', 'mcq', 1, 'easy', ?, ?, 0, 0)`);
  for (let i = 0; i < nQuestions; i++) ins.run(`q_${i}`, `word${i} common stem`, `h${i}`);
}

// ---------------------------------------------------------------------------
console.log("search index survives VACUUM");
{
  const f = new Database(join(process.env.TEMP ?? "/tmp", `orbit-check-${process.pid}.sqlite3`));
  try {
    f.exec("PRAGMA foreign_keys = ON;");
    f.exec(schema);
    seed(f, 6);
    f.exec("DELETE FROM questions WHERE id IN ('q_0', 'q_2')"); // leave gaps that VACUUM could close
    f.exec("VACUUM");
    const hit = f
      .query(
        `SELECT q.id FROM questions_fts JOIN questions q ON q.n = questions_fts.rowid
                         WHERE questions_fts MATCH 'word4'`,
      )
      .all() as { id: string }[];
    ok(hit.length === 1 && hit[0].id === "q_4", "search finds the right question after VACUUM");
    f.exec("INSERT INTO questions_fts(questions_fts) VALUES ('integrity-check')");
    ok(true, "FTS integrity-check passes");
  } catch (e) {
    ok(false, "search index: " + String(e));
  } finally {
    f.close();
  }
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
    if (rnd() < 0.15)
      ev.run(q, t, null, null, null); // skip
    else ev.run(q, t, t + 500, rnd() < 0.6 ? "right" : "wrong", 500);
  }
  same("after 400 practice answers inserted out of order");

  db.exec(
    "UPDATE practice_events SET answered_at = shown_at + 10, outcome = 'right', ms = 10 WHERE outcome IS NULL AND id % 2 = 0",
  );
  same("after answering shown (skipped) rows");

  db.exec(
    "UPDATE practice_events SET outcome = CASE outcome WHEN 'right' THEN 'wrong' ELSE 'right' END WHERE id % 7 = 0 AND outcome IS NOT NULL",
  );
  same("after correcting some outcomes");

  db.exec("DELETE FROM practice_events WHERE id % 5 = 0");
  same("after deleting some practice answers");

  // Two mocks: one scored, one later marked failed, then the scored one deleted.
  for (const [aid, at] of [
    ["at_1", 1_200_500],
    ["at_2", 1_300_500],
  ] as const) {
    db.exec(
      `INSERT INTO attempts(id, title, created_at, started_at, duration_sec) VALUES ('${aid}', 'Mock', 0, 0, 3600)`,
    );
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
  ok(
    (db.query("SELECT count(*) AS n FROM attempt_items WHERE attempt_id = 'at_1'").get() as { n: number }).n === 0,
    "deleting an attempt cascades to its items",
  );
  same("after deleting a whole attempt");

  let blocked = false;
  db.exec(`INSERT INTO attempts(id, title, created_at, duration_sec) VALUES ('at_3', 'Open', 0, 3600)`);
  db.exec(`INSERT INTO attempt_sections(attempt_id, position, name) VALUES ('at_3', 0, 'S')`);
  db.exec(
    `INSERT INTO attempt_items(attempt_id, question_id, position, section_pos, question_rev) VALUES ('at_3', 'q_1', 0, 0, 1)`,
  );
  try {
    db.exec("UPDATE attempt_items SET outcome = 'right' WHERE attempt_id = 'at_3'");
  } catch {
    blocked = true;
  }
  ok(blocked, "outcome on an unsubmitted attempt is refused");

  db.exec("DELETE FROM practice_events");
  db.exec("DELETE FROM attempts");
  ok(
    (db.query("SELECT count(*) AS n FROM question_stats").get() as { n: number }).n === 0,
    "deleting every answer empties question_stats",
  );
}

// ---------------------------------------------------------------------------
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

if (failed) {
  console.log(`\n${failed} FAILED`);
  process.exit(1);
}
console.log("\nALL OK");
