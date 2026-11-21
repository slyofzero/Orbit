// check.ts section: practice sitting (clock, rules, queries). Run: bun run check
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ActiveClock, IDLE_CUTOFF_MS } from "@/lib/activeClock";
import { parseQuestionFile, questionSummary } from "@/lib/questionFile";
import { outcomeOf, paletteState, pendingSkips, startIndex, summarize } from "@/lib/session";
import { QUERIES } from "@/lib/db/queries";
import { transaction } from "@/lib/db/sql";
import type { TopicQuestions } from "@/lib/questions";
import { ok, freshDb, run, seed, bunSql } from "@/scripts/checks/helpers";

// ---------------------------------------------------------------------------
console.log("active clock (lib/activeClock.ts)");
{
  const c = new ActiveClock();
  c.start(0);
  c.activity(30_000);
  ok(c.elapsed(40_000) === 40_000, "clock: runs while the learner is active");
  c.stop(50_000);
  ok(c.elapsed(900_000) === 50_000, "clock: stopped, it holds its value");
  c.start(100_000);
  ok(c.elapsed(125_000) === 75_000, "clock: time is summed across visits");

  const idle = new ActiveClock();
  idle.start(0);
  idle.activity(10_000);
  ok(
    idle.elapsed(10_000 + IDLE_CUTOFF_MS + 500_000) === 10_000 + IDLE_CUTOFF_MS,
    "clock: stops counting after the idle cutoff",
  );
  idle.activity(10_000 + IDLE_CUTOFF_MS + 500_000);
  ok(
    idle.elapsed(10_000 + IDLE_CUTOFF_MS + 510_000) === 10_000 + IDLE_CUTOFF_MS + 10_000,
    "clock: restarts on the next activity without counting the gap",
  );

  const idle2 = new ActiveClock();
  idle2.start(0);
  idle2.stop(IDLE_CUTOFF_MS * 3);
  ok(idle2.elapsed(0) === IDLE_CUTOFF_MS, "clock: stopping after a long idle only counts up to the cutoff");

  const never = new ActiveClock();
  never.activity(5_000);
  ok(never.elapsed(9_000) === 0 && !never.running, "clock: activity before start does nothing");
}

// ---------------------------------------------------------------------------
console.log("practice sitting rules (lib/session.ts)");
{
  ok(
    startIndex([{ latest: "correct" }, { latest: "incorrect" }, { latest: null }, { latest: null }]) === 2,
    "start: opens on the first question never tried",
  );
  ok(
    startIndex([{ latest: "correct" }]) === 0 && startIndex([]) === 0,
    "start: all tried (or none) opens on the first",
  );
  ok(outcomeOf("correct") === "correct" && outcomeOf(null) === "skipped", "outcome: nothing answered is skipped");
  ok(
    paletteState("correct", true) === "right" &&
      paletteState("incorrect", true) === "wrong" &&
      paletteState(undefined, true) === "seen" &&
      paletteState(undefined, false) === "new" &&
      paletteState("skipped", true) === "seen",
    "palette: right, wrong, seen, new",
  );
  ok(
    pendingSkips(["a", "b", "c"], new Set(["b"])).join() === "a,c",
    "skips: opened questions not yet written, in order",
  );
  const s = summarize({ a: "correct", b: "correct", c: "incorrect" }, 5);
  ok(
    s.answered === 3 && s.right === 2 && s.wrong === 1 && s.unanswered === 2 && s.accuracy === 67,
    "summary: counts and accuracy",
  );
  ok(
    summarize({}, 4).accuracy === null && summarize({}, 4).unanswered === 4,
    "summary: nothing answered has no accuracy",
  );
}

// ---------------------------------------------------------------------------
console.log("question queries (lib/db/queries/question.ts)");
{
  const d = freshDb();
  seed(d, 3); // q_0..q_2, mcq, topic tp_1
  run(d, "INSERT INTO topics(id, subject_id, name) VALUES ('tp_2', 'sb_1', 'Other')");
  const q = (id: string, type: string, topic: string, pool = "practice") =>
    run(
      d,
      `INSERT INTO questions(id, type, topic_id, pool, marks, difficulty, stem, content_hash, created_at, updated_at)
       VALUES ('${id}', '${type}', '${topic}', '${pool}', 1, 'easy', 'stem ${id}', 'h_${id}', 5, 5)`,
    );
  q("q_nat", "nat", "tp_1");
  run(d, "INSERT INTO question_nat(question_id, value, tolerance) VALUES ('q_nat', 2.5, 0.1)");
  q("q_code", "code", "tp_1");
  run(d, "INSERT INTO question_code(question_id, starter) VALUES ('q_code', 'x')");
  q("q_mockonly", "mcq", "tp_1", "mock");
  run(d, `INSERT INTO question_mcq(question_id, options, correct) VALUES ('q_mockonly', '["a","b"]', 1)`);
  q("q_other", "mcq", "tp_2");
  run(d, `INSERT INTO question_mcq(question_id, options, correct) VALUES ('q_other', '["a","b"]', 0)`);
  const sql = bunSql(d);

  const topic = QUERIES["question.topic"].run(sql, { topicId: "tp_1" }) as TopicQuestions;
  ok(topic.topic?.name === "Topic" && topic.topic.subject_name === "Subject", "question.topic: names the topic");
  ok(
    topic.items.map((i) => i.question.id).join() === "q_0,q_1,q_2,q_nat",
    "question.topic: practice questions of that topic only, no code, no mock-only, oldest first",
  );
  const first = topic.items[0].detail as { options: string[]; correct: number };
  ok(
    Array.isArray(first.options) && first.options.length === 4 && first.correct === 0,
    "question.topic: the mcq row comes back decoded",
  );
  ok(
    (topic.items[3].detail as { value: number }).value === 2.5 && topic.items.every((i) => i.latest === null),
    "question.topic: other types too; nothing tried yet",
  );
  ok(
    (QUERIES["question.topic"].run(sql, { topicId: "nope" }) as TopicQuestions).topic === null,
    "question.topic: an unknown topic is null",
  );

  const rec = QUERIES["question.record"];
  rec.run(sql, {
    answers: [
      { questionId: "q_0", outcome: "correct", timeMs: 4200.6 },
      { questionId: "q_1", outcome: "incorrect", timeMs: 1000 },
      { questionId: "q_2", outcome: "skipped", timeMs: -5 },
    ],
  });
  const rows = d.query("SELECT question_id, outcome, time_ms, attempt_id FROM question_answers ORDER BY id").all() as {
    question_id: string;
    outcome: string;
    time_ms: number;
    attempt_id: string | null;
  }[];
  ok(
    rows.length === 3 && rows[0].time_ms === 4201 && rows[2].time_ms === 0 && rows.every((r) => r.attempt_id === null),
    "question.record: one practice row per answer, time rounded and never negative",
  );
  const stat = d.query("SELECT visited, correct, incorrect FROM question_stats WHERE question_id = 'q_0'").get();
  ok(
    JSON.stringify(stat) === JSON.stringify({ visited: 1, correct: 1, incorrect: 0 }),
    "question.record: stats follow",
  );
  let refused = false;
  try {
    rec.run(sql, { answers: [{ questionId: "q_0", outcome: "maybe" as never, timeMs: 1 }] });
  } catch {
    refused = true;
  }
  ok(refused, "question.record: an unknown outcome is refused");

  const again = QUERIES["question.topic"].run(sql, { topicId: "tp_1" }) as TopicQuestions;
  ok(
    again.items.map((i) => i.question.id).join() === "q_0,q_1,q_2,q_nat" &&
      again.items[0].latest === "correct" &&
      again.items[1].latest === "incorrect" &&
      again.items[2].latest === null,
    "question.topic: order stays put after answering; latest counts answers, skips ignored",
  );
}

// ---------------------------------------------------------------------------
console.log("sample question pack (samples/questions/sample-topics.json)");
{
  const text = readFileSync(join(import.meta.dir, "..", "..", "samples", "questions", "sample-topics.json"), "utf8");
  const parsed = parseQuestionFile(text);
  ok(parsed.file && parsed.warnings.length === 0, "sample pack: the dev button's file is valid, no warnings");
  ok(parsed.file && questionSummary(parsed.file).practice === 10, "sample pack: 10 practice questions");
  const full = parseQuestionFile(
    readFileSync(join(import.meta.dir, "..", "..", "samples", "questions", "sample-full-pack.json"), "utf8"),
  );
  const sum = full.file && questionSummary(full.file);
  ok(
    full.errors.length === 0 &&
      full.warnings.length === 0 &&
      sum?.practice === 32 &&
      sum.programming === 7 &&
      sum.mocks === 2,
    "full sample pack (the Topics DEV button's file): valid, no warnings, 32 practice · 7 programming · 2 mocks",
  );
}
{
  const d = freshDb();
  const sql = bunSql(d);
  const text = readFileSync(join(import.meta.dir, "..", "..", "samples", "questions", "sample-topics.json"), "utf8");
  transaction(sql, () => QUERIES["pack.import"].run(sql, { text, fileName: "sample-topics.json", fileHash: "h" }));
  const topic = d.query("SELECT id FROM topics WHERE name = 'Eigenvalues'").get() as { id: string };
  const t = QUERIES["question.topic"].run(sql, { topicId: topic.id }) as TopicQuestions;
  const want = (JSON.parse(text).questions as { topic: string; text: string }[])
    .filter((q) => q.topic === "Eigenvalues")
    .map((q) => q.text);
  ok(
    t.items.length === 4 && t.items.every((x, i) => x.question.stem === want[i]),
    "question.topic: an imported file's questions keep the file's order",
  );
  const pick = t.items[2].question.id;
  const one = QUERIES["question.topic"].run(sql, { topicId: topic.id, questionId: pick }) as TopicQuestions;
  const gone = QUERIES["question.topic"].run(sql, { topicId: topic.id, questionId: "q_nope" }) as TopicQuestions;
  const byId = QUERIES["question.topic"].run(sql, { questionId: pick }) as TopicQuestions; // no topic in the address
  ok(
    one.items.length === 1 &&
      one.items[0].question.id === pick &&
      one.items[0].detail &&
      gone.items.length === 0 &&
      byId.topic?.id === topic.id &&
      byId.items.length === 1,
    "question.topic with questionId: a sitting of just that question (Manage pack opens a row this way)",
  );
}
