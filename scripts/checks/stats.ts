// check.ts section: Stats page (rules in lib/stats.ts, queries in lib/db/queries/stats.ts). Run: bun run check
import { QUERIES } from "@/lib/db/queries";
import {
  answerWeight,
  accuracy,
  fillDays,
  formatDuration,
  historyHref,
  istClock,
  questionHref,
  type QuestionHistory,
  rankStrength,
  shares,
  streakOf,
  streaks,
  strengths,
  strengthText,
  topicHref,
  type StatsQuestion,
  type StatsSummary,
} from "@/lib/stats";
import { ok, freshDb, run, seed, bunSql, at } from "@/scripts/checks/helpers";

const DAY = 86_400_000;

// ---------------------------------------------------------------------------
console.log("stats rules (lib/stats.ts)");
{
  const now = 100 * DAY;
  const w = (difficulty: "easy" | "medium" | "hard", outcome: "correct" | "incorrect", age = 0) =>
    answerWeight({ difficulty, outcome, recorded_at: now - age * DAY }, now);
  ok(w("medium", "correct") === 1, "weight: a fresh medium answer weighs 1");
  ok(Math.abs(w("medium", "correct", 14) - 0.5) < 1e-9, "weight: halves every 14 days");
  ok(w("hard", "correct") === 1.3 && w("easy", "incorrect") === 1.3, "weight: hard right / easy wrong count more");
  ok(w("medium", "correct", -5) === 1, "weight: a future answer counts as new");

  const s = strengths(
    [
      { question_id: "a", group: "T1", difficulty: "medium", outcome: "correct", recorded_at: now },
      { question_id: "b", group: "T2", difficulty: "medium", outcome: "incorrect", recorded_at: now },
    ],
    now,
  );
  ok(s.overall === 0.5, "strength: overall weighted accuracy");
  ok(Math.abs(s.by.get("T1")! - 3.5 / 6) < 1e-9, "strength: one right answer is smoothed towards the average");
  ok(Math.abs(s.by.get("T2")! - 2.5 / 6) < 1e-9, "strength: one wrong answer too");
  ok(strengths([], now).overall === null, "strength: nothing answered = null");

  ok(streakOf(["correct", "correct", "incorrect", "correct"]) === 2, "streak: right answers in a row from the latest");
  ok(streakOf(["incorrect", "correct"]) === 0 && streakOf([]) === 0, "streak: latest wrong = 0");
  const st = streaks([
    { question_id: "q", outcome: "correct", recorded_at: 3 },
    { question_id: "q", outcome: "incorrect", recorded_at: 1 },
    { question_id: "q", outcome: "correct", recorded_at: 2 },
  ]);
  ok(st.get("q") === 2, "streaks: sorted newest first whatever the input order");

  const r = rankStrength([
    { id: "a", strength: 0.9, answered: 10, coverage: 0.5 },
    { id: "b", strength: 0.2, answered: 10, coverage: 0.5 },
    { id: "c", strength: 0.95, answered: 2, coverage: 0.1 },
    { id: "d", strength: null, answered: 0, coverage: 0 },
  ]);
  ok(r.weakest[0].id === "b" && !r.weakest.some((x) => x.id === "d"), "rank: weakest first, unstarted left out");
  ok(!r.strongest.some((x) => x.id === "c"), "rank: strongest needs 20% coverage");
  ok(!r.strongest.some((x) => r.weakest.includes(x)), "rank: a topic is never in both lists");

  const days = fillDays([{ day: "2026-11-21", answered: 3, correct: 2, time_ms: 60_000 }], "2026-11-22", 3);
  ok(days.map((d) => d.day).join() === "2026-11-20,2026-11-21,2026-11-22", "days: the last n days, oldest first");
  ok(days[1].answered === 3 && days[0].answered === 0 && days[2].time_ms === 0, "days: missing days are zeros");

  ok(accuracy(3, 1) === 75 && accuracy(0, 0) === null, "accuracy: percent of counted answers");
  ok(
    formatDuration(null) === "—" &&
      formatDuration(45_000) === "45s" &&
      formatDuration(200_000) === "3m 20s" &&
      formatDuration(120_000) === "2m" &&
      formatDuration(7_500_000) === "2h 5m",
    "duration: 45s, 3m 20s, 2m, 2h 5m",
  );
  ok(strengthText(null) === "not started" && strengthText(0.644) === "64%", "strength text");
  const sh = shares({ total: 8, q_right: 4, q_wrong: 2, q_skipped: 1 });
  ok(sh.good === 50 && sh.bad === 25 && sh.skipped === 12.5, "shares: questions right, wrong, opened (of all)");
  ok(shares({ total: 0, q_right: 0, q_wrong: 0, q_skipped: 0 }).good === 0, "shares: no questions = empty bar");
  ok(
    topicHref({ id: "t 1", practice: 2 }) === "/practice/session?topic=t%201" &&
      topicHref({ id: "t", practice: 0 }) === undefined,
    "topic link: only when there is something to practise",
  );
  ok(
    questionHref({ id: "q", type: "mcq", pool: "mock" }).startsWith("/practice/manage?q=") &&
      questionHref({ id: "q", type: "code", pool: "practice" }).startsWith("/practice/code?id=") &&
      questionHref({ id: "q", type: "nat", pool: "practice" }).startsWith("/practice/session?q="),
    "question link: editor for mock-only, Programming for code, else practice",
  );
}

// ---------------------------------------------------------------------------
console.log("stats queries (lib/db/queries/stats.ts)");
{
  const d = freshDb();
  seed(d, 4); // q_0..q_3, topic tp_1 in sb_1
  run(d, "INSERT INTO subjects(id, name, position) VALUES ('sb_2', 'Second', 1)");
  run(d, "INSERT INTO topics(id, subject_id, name) VALUES ('tp_2', 'sb_2', 'Other')");
  run(
    d,
    `INSERT INTO questions(id, type, topic_id, marks, difficulty, stem, content_hash, created_at, updated_at)
     VALUES ('q_x', 'mcq', 'tp_2', 1, 'easy', 'other', 'h_x', 1, 1)`,
  );
  run(d, `INSERT INTO question_mcq(question_id, options, correct) VALUES ('q_x', '["a","b"]', 0)`);
  const ans = (q: string, outcome: string, date: string, ms: number, hours = 12) =>
    run(
      d,
      `INSERT INTO question_answers(question_id, recorded_at, outcome, time_ms) VALUES ('${q}', ${at(date, hours)}, '${outcome}', ${ms})`,
    );
  const today = "2026-11-22";
  ans("q_0", "correct", "2026-11-20", 30_000);
  ans("q_0", "correct", "2026-11-21", 20_000);
  ans("q_0", "correct", today, 10_000);
  ans("q_1", "correct", "2026-11-21", 40_000);
  ans("q_1", "incorrect", today, 50_000);
  ans("q_2", "skipped", today, 5_000);
  ans("q_x", "incorrect", "2026-10-01", 60_000);
  // a mock-only question in the topic: not in the topic's question count
  run(
    d,
    `INSERT INTO questions(id, type, topic_id, pool, marks, difficulty, stem, content_hash, created_at, updated_at)
     VALUES ('q_mock', 'mcq', 'tp_1', 'mock', 1, 'easy', 'mock only', 'h_mock', 1, 1)`,
  );
  const sql = bunSql(d);

  const s = QUERIES["stats.summary"].run(sql, { today }) as StatsSummary;
  ok(
    s.totals.shown === 7 && s.totals.correct === 4 && s.totals.incorrect === 2 && s.totals.skipped === 1,
    "summary: counts right, wrong and skipped",
  );
  ok(s.totals.time_ms === 215_000 && s.totals.answered_ms === 210_000, "summary: time, skips included and not");
  ok(s.totals.total === 5 && s.totals.tried === 3, "summary: questions tried of live ones");
  ok(s.totals.mastered === 1 && s.totals.mistakes === 2, "summary: mastered (3 right in a row) and the mistake log");
  ok(s.days.length === 14 && s.days[13].day === today, "summary: 14 days ending today");
  ok(s.days[13].answered === 2 && s.days[13].correct === 1 && s.days[13].time_ms === 65_000, "summary: today's bar");
  ok(
    s.days.every((x) => x.day !== "2026-10-01"),
    "summary: older days are not in the bars",
  );
  const t1 = s.topics.find((t) => t.id === "tp_1")!;
  ok(
    t1.correct === 4 && t1.incorrect === 1 && t1.skipped === 1 && t1.tried === 2 && t1.total === 4,
    "summary: topic counts",
  );
  ok(
    t1.q_right === 1 && t1.q_wrong === 1 && t1.q_skipped === 1,
    "summary: questions by latest answer (right, wrong, only opened; one never seen)",
  );
  ok(s.subjects[0].q_right === 1 && s.subjects[0].q_skipped === 1, "summary: subjects sum the breakdown");
  ok(t1.practice === 4 && t1.strength !== null, "summary: topic practice count and strength");
  ok(
    s.subjects.map((x) => x.id).join() === "sb_1,sb_2" && s.subjects[0].time_ms === t1.time_ms,
    "summary: subjects in order, summed from their topics",
  );
  ok(s.weakest[0]?.id === "tp_2", "summary: the weakest topic");

  const all = QUERIES["stats.questions"].run(sql, {}) as { rows: StatsQuestion[]; matched: number };
  ok(all.matched === 4 && all.rows[0].last_at! >= all.rows[3].last_at!, "questions: every shown one, recent first");
  const q1 = all.rows.find((r) => r.id === "q_1")!;
  ok(
    q1.correct === 1 && q1.incorrect === 1 && q1.time_ms === 90_000 && q1.latest === "incorrect",
    "questions: one row",
  );
  ok(all.rows.find((r) => r.id === "q_2")!.latest === null, "questions: only skipped = no latest answer");
  const mistakes = QUERIES["stats.questions"].run(sql, { show: "mistakes" }) as {
    rows: StatsQuestion[];
    matched: number;
  };
  ok(
    mistakes.rows
      .map((r) => r.id)
      .sort()
      .join() === "q_1,q_x",
    "questions: the mistake log",
  );
  const bySub = QUERIES["stats.questions"].run(sql, { subjectId: "sb_2" }) as { matched: number };
  ok(bySub.matched === 1, "questions: filter by subject");
  const byTime = QUERIES["stats.questions"].run(sql, { sort: "time", limit: 1 }) as { rows: StatsQuestion[] };
  ok(byTime.rows.length === 1 && byTime.rows[0].id === "q_1", "questions: sort by time, one page");
  const page2 = QUERIES["stats.questions"].run(sql, { limit: 3, offset: 3 }) as { rows: StatsQuestion[] };
  ok(page2.rows.length === 1, "questions: offset pages");
  const h = QUERIES["stats.history"].run(sql, { questionId: "q_1" }) as QuestionHistory;
  ok(
    h.question?.id === "q_1" && h.question.shown === 2 && h.question.time_ms === 90_000,
    "history: the question and its totals",
  );
  ok(
    h.entries.map((e) => e.outcome).join() === "incorrect,correct" && h.entries[0].attempt_id === null,
    "history: every sitting, newest first, practice",
  );
  ok(h.streak === 0, "history: latest wrong = no streak");
  const h0 = QUERIES["stats.history"].run(sql, { questionId: "q_0" }) as QuestionHistory;
  ok(h0.streak === 3 && h0.entries.length === 3, "history: three right in a row");
  const never = QUERIES["stats.history"].run(sql, { questionId: "q_3" }) as QuestionHistory;
  ok(never.question?.shown === 0 && never.entries.length === 0, "history: a question never shown has zero counts");
  ok(
    (QUERIES["stats.history"].run(sql, { questionId: "nope" }) as QuestionHistory).question === null,
    "history: an unknown question is null",
  );
  ok(historyHref("q 1") === "/stats/question?id=q%201", "history: page address carries the question id");
  ok(istClock(at("2026-11-22", 14) + 5 * 60_000) === "14:05", "history: IST clock time");

  run(d, "UPDATE questions SET retired_at = 1 WHERE id = 'q_x'");
  const after = QUERIES["stats.questions"].run(sql, {}) as { matched: number };
  const s2 = QUERIES["stats.summary"].run(sql, { today }) as StatsSummary;
  ok(after.matched === 3 && s2.totals.incorrect === 2, "retired: hidden from the list, its answers still count");

  const gone = QUERIES["stats.clear"].run(sql, undefined as never) as { answers: number; attempts: number };
  const n = (q: string) => (d.query(q).get() as { n: number }).n;
  ok(gone.answers === 7 && gone.attempts === 0, "clear: says what went");
  ok(
    n("SELECT count(*) AS n FROM question_answers") === 0 && n("SELECT count(*) AS n FROM question_stats") === 0,
    "clear: every answer gone, question_stats emptied",
  );
  ok(n("SELECT count(*) AS n FROM questions") === 6, "clear: the questions stay");
  ok((QUERIES["stats.summary"].run(sql, { today }) as StatsSummary).totals.shown === 0, "clear: stats are empty");
}
