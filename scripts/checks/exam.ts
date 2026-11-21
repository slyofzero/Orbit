// check.ts section: mock tests (lib/exam.ts rules, lib/db/queries/mock.ts) and the Programming screen query.
// Run: bun run check
import {
  ALLOWED_WARNINGS,
  builtMinutes,
  cleanResponse,
  clockText,
  clockTone,
  countStatuses,
  examStatus,
  failsAfter,
  gradeResponse,
  hasResponse,
  outcomeOfGrade,
  pickQuestions,
  scoreOf,
  timeLeftMs,
  type AttemptData,
  type MockIntro,
} from "@/lib/exam";
import { QUERIES } from "@/lib/db/queries";
import type { CodeQuestionData } from "@/lib/questions";
import { ok, freshDb, run, seed, bunSql, count } from "@/scripts/checks/helpers";

const mcq = { type: "mcq" as const, marks: 2, negative_marks: 0.5 };
const NONE = { choice: null, typed: null };

// ---------------------------------------------------------------------------
console.log("mock rules (lib/exam.ts)");
{
  ok(
    !hasResponse(NONE) && !hasResponse({ choice: [], typed: null }) && !hasResponse({ choice: null, typed: "  " }),
    "response: nothing picked or only spaces is no answer",
  );
  ok(hasResponse({ choice: [1], typed: null }) && hasResponse({ choice: null, typed: "0" }), "response: an answer");
  ok(
    JSON.stringify(cleanResponse("msq", { choice: [3, 1, 3], typed: null })) ===
      JSON.stringify({ choice: [1, 3], typed: null }) &&
      JSON.stringify(cleanResponse("mcq", { choice: [2, 0], typed: null })) ===
        JSON.stringify({ choice: [0], typed: null }) &&
      cleanResponse("nat", { choice: null, typed: " 4 " }).typed === "4" &&
      cleanResponse("str", { choice: null, typed: "   " }).typed === null &&
      cleanResponse("code", { choice: null, typed: "  x = 1\n" }).typed === "  x = 1\n",
    "clean: options sorted once (mcq keeps one), text trimmed, empty is nothing, code kept as written",
  );
  ok(
    examStatus({ visited: false, marked: false, ...NONE }) === "not_visited" &&
      examStatus({ visited: true, marked: false, ...NONE }) === "not_answered" &&
      examStatus({ visited: true, marked: false, choice: [0], typed: null }) === "answered" &&
      examStatus({ visited: true, marked: true, ...NONE }) === "marked" &&
      examStatus({ visited: true, marked: true, choice: null, typed: "3" }) === "answered_marked",
    "status: the five palette states",
  );
  const c = countStatuses(["answered", "answered", "marked", "not_visited"]);
  ok(c.answered === 2 && c.marked === 1 && c.not_visited === 1 && c.not_answered === 0, "status: counted");

  const right = gradeResponse(mcq, { question_id: "q", options: ["a", "b"], correct: 1 }, { choice: [1], typed: null });
  const wrong = gradeResponse(mcq, { question_id: "q", options: ["a", "b"], correct: 1 }, { choice: [0], typed: null });
  const blank = gradeResponse(mcq, { question_id: "q", options: ["a", "b"], correct: 1 }, NONE);
  ok(right.verdict === "correct" && right.marks === 2, "grade: mcq right earns its marks");
  ok(wrong.verdict === "incorrect" && wrong.marks === -0.5, "grade: mcq wrong loses the negative marks");
  ok(blank.verdict === null && blank.marks === 0, "grade: nothing answered earns 0");
  ok(
    gradeResponse(
      { type: "nat", marks: 1, negative_marks: 0 },
      { question_id: "q", value: 2.5, tolerance: 0.1 },
      { choice: null, typed: "2.55" },
    ).marks === 1,
    "grade: nat within tolerance",
  );
  ok(
    gradeResponse(
      { type: "msq", marks: 2, negative_marks: 0 },
      { question_id: "q", options: ["a", "b", "c"], correct: [0, 2] },
      { choice: [0], typed: null },
    ).verdict === "incorrect",
    "grade: msq is all or nothing",
  );
  const code = gradeResponse(
    { type: "code", marks: 5, negative_marks: 0 },
    { question_id: "q", starter: null },
    { choice: null, typed: "print(1)" },
  );
  ok(code.marks === null && outcomeOfGrade(code) === "skipped", "grade: code is not scored and stored as skipped");
  ok(outcomeOfGrade(right) === "correct" && outcomeOfGrade(blank) === "skipped", "grade: outcomes");
  const s = scoreOf([
    { type: "mcq", full: 2, marks: 2 },
    { type: "mcq", full: 2, marks: -0.5 },
    { type: "nat", full: 1, marks: 0 },
    { type: "code", full: 5, marks: null },
  ]);
  ok(s.score === 1.5 && s.max === 5, "score: sum with negative marking; code in neither");

  ok(timeLeftMs(1000, 1, 31_000) === 30_000 && timeLeftMs(0, 1, 999_999) === 0, "clock: time left, never below 0");
  ok(clockText(3_727_000) === "01:02:07" && clockText(500) === "00:00:01", "clock: hh:mm:ss, rounded up");
  ok(
    clockTone(11 * 60_000) === "normal" && clockTone(9 * 60_000) === "low" && clockTone(60_000) === "critical",
    "clock: amber in the last 10 minutes, red in the last 2",
  );
  ok(ALLOWED_WARNINGS === 1 && !failsAfter(1) && failsAfter(2), "full screen: the first exit warns, the second fails");

  const pool = [
    { id: "a", seen: true, subject_id: "x" },
    { id: "b", seen: false, subject_id: "x" },
    { id: "c", seen: false, subject_id: "x" },
    { id: "d", seen: true, subject_id: "y" },
    { id: "e", seen: false, subject_id: "y" },
  ];
  const firstThree = pickQuestions(pool, 3, false, () => 0.5);
  ok(firstThree.every((q) => !q.seen) && firstThree.length === 3, "build: never-answered questions come first");
  ok(pickQuestions(pool, 50, false).length === 5, "build: at most what there is");
  const spread = pickQuestions(pool, 2, true, () => 0.5);
  ok(new Set(spread.map((q) => q.subject_id)).size === 2, "build: the quick test takes from every subject");
  ok(builtMinutes(1) === 5 && builtMinutes(10) === 18, "build: about 1.8 minutes per mark, at least 5");
}

// ---------------------------------------------------------------------------
console.log("mock queries (lib/db/queries/mock.ts)");
{
  const d = freshDb();
  seed(d, 3); // q_0..q_2: mcq, 1 mark, correct = option 0, topic tp_1
  run(d, "UPDATE questions SET negative_marks = 0.25");
  run(
    d,
    `INSERT INTO questions(id, type, topic_id, marks, difficulty, stem, content_hash, created_at, updated_at)
     VALUES ('q_code', 'code', 'tp_1', 3, 'easy', 'write it', 'h_code', 0, 0)`,
  );
  run(d, "INSERT INTO question_code(question_id, starter) VALUES ('q_code', NULL)");
  const sql = bunSql(d);

  // a short test built from practice questions (code questions are left out)
  const built = QUERIES["mock.build"].run(sql, { kind: "topic", topicId: "tp_1" }) as string;
  ok(typeof built === "string", "build: makes a mock");
  ok(
    count(
      d,
      `SELECT count(*) AS n FROM mock_items i JOIN mock_sections s ON s.id = i.section_id WHERE s.mock_id = '${built}'`,
    ) === 3,
    "build: its questions are the topic's practice questions, no code",
  );
  ok(
    count(d, `SELECT count(*) AS n FROM mocks WHERE id = '${built}' AND retired_at IS NOT NULL`) === 1,
    "build: saved hidden, so it isn't listed as a full-length mock",
  );
  ok(QUERIES["mock.build"].run(sql, { kind: "topic", topicId: "nope" }) === null, "build: nothing matches → null");
  const intro = QUERIES["mock.intro"].run(sql, { mockId: built }) as MockIntro;
  ok(intro.mock?.name === "Topic test: Topic" && intro.questions === 3 && intro.marks === 3, "intro: counts and marks");

  // a hand-made mock with a code question, in two sections
  run(
    d,
    `INSERT INTO mocks(id, name, minutes, full_screen, created_at, updated_at) VALUES ('mk_1', 'Paper', 60, 1, 0, 0)`,
  );
  run(d, "INSERT INTO mock_sections(id, mock_id, name, position) VALUES (101, 'mk_1', 'A', 1), (102, 'mk_1', 'B', 2)");
  run(
    d,
    `INSERT INTO mock_items(section_id, question_id, position) VALUES
     (101, 'q_0', 1), (101, 'q_1', 2), (102, 'q_2', 1), (102, 'q_code', 2)`,
  );
  const intro2 = QUERIES["mock.intro"].run(sql, { mockId: "mk_1" }) as MockIntro;
  ok(
    intro2.mock?.full_screen === true && intro2.sections.length === 2 && intro2.marks === 3 && intro2.code === 1,
    "intro: sections, full screen, code left out of the marks",
  );

  const id = QUERIES["mock.start"].run(sql, { mockId: "mk_1" }) as string;
  const att = () => QUERIES["mock.attempt"].run(sql, { attemptId: id }) as AttemptData;
  const a0 = att();
  ok(
    a0.attempt?.status === "in_progress" && a0.items.length === 4 && a0.attempt.sections[1].name === "B",
    "start: the attempt holds every question and the sections",
  );
  ok(
    a0.items[0].item.visited && !a0.items[1].item.visited && a0.items[3].item.section === 1,
    "start: the first question is open; items know their section",
  );
  let refused = false;
  try {
    QUERIES["mock.start"].run(sql, { mockId: built });
  } catch {
    refused = true;
  }
  ok(refused, "start: refused while another test is in progress");
  ok((QUERIES["mock.open"].run(sql) as { id: string } | null)?.id === id, "open: the test in progress");

  QUERIES["mock.save"].run(sql, {
    attemptId: id,
    current: 2,
    items: [
      { questionId: "q_0", response: { choice: [0], typed: null }, timeMs: 5000 }, // right
      { questionId: "q_1", response: { choice: [2], typed: null }, marked: true, visited: true }, // wrong, marked
      { questionId: "q_2", visited: true }, // opened, not answered
    ],
  });
  const a1 = att();
  ok(
    a1.attempt?.current === 2 &&
      JSON.stringify(a1.items[0].item.choice) === "[0]" &&
      a1.items[0].item.time_ms === 5000 &&
      a1.items[1].item.marked &&
      examStatus(a1.items[2].item) === "not_answered" &&
      examStatus(a1.items[3].item) === "not_visited",
    "save: responses, marks, visits and time are kept",
  );

  const w1 = QUERIES["mock.warn"].run(sql, { attemptId: id, times: {} }) as { warnings: number; failed: boolean };
  ok(w1.warnings === 1 && !w1.failed, "warn: the first exit from full screen only warns");

  const r = QUERIES["mock.submit"].run(sql, { attemptId: id, times: { q_2: 700 } }) as { score: number; max: number };
  ok(r.score === 0.75 && r.max === 3, "submit: +1 right, −0.25 wrong, 0 blank; code not in the max");
  const a2 = att();
  ok(
    a2.attempt?.status === "submitted" && a2.attempt.score === 0.75 && a2.items[1].item.marks === -0.25,
    "submit: the attempt and each question keep their marks",
  );
  const answers = d
    .query(`SELECT question_id, outcome, time_ms FROM question_answers WHERE attempt_id = '${id}' ORDER BY question_id`)
    .all() as { question_id: string; outcome: string; time_ms: number }[];
  ok(
    answers.map((x) => `${x.question_id}:${x.outcome}`).join() === "q_0:correct,q_1:incorrect,q_2:skipped",
    "submit: one answer per visited question; unvisited ones (the code question) write nothing",
  );
  ok(answers[2].time_ms === 700, "submit: the final times are stored");
  const again = QUERIES["mock.submit"].run(sql, { attemptId: id, times: {} }) as { score: number };
  ok(again.score === 0.75 && count(d, "SELECT count(*) AS n FROM question_answers") === 3, "submit: twice is harmless");
  ok(
    QUERIES["mock.save"].run(sql, { attemptId: id, items: [{ questionId: "q_0", marked: true }] }) === false,
    "save: ignored once the attempt has ended",
  );

  // failing after a second exit, and quitting
  const f = QUERIES["mock.start"].run(sql, { mockId: "mk_1" }) as string;
  QUERIES["mock.warn"].run(sql, { attemptId: f, times: {} });
  const w2 = QUERIES["mock.warn"].run(sql, { attemptId: f, times: {} }) as { failed: boolean };
  ok(
    w2.failed && count(d, `SELECT count(*) AS n FROM mock_attempts WHERE id = '${f}' AND status = 'failed'`) === 1,
    "warn: the second exit fails the attempt",
  );
  const q = QUERIES["mock.start"].run(sql, { mockId: built }) as string;
  ok(
    QUERIES["mock.end"].run(sql, { attemptId: q, status: "abandoned", times: {} }) === true &&
      count(d, `SELECT count(*) AS n FROM mock_attempts WHERE id = '${q}' AND status = 'abandoned'`) === 1 &&
      count(d, `SELECT count(*) AS n FROM question_answers WHERE attempt_id IN ('${f}', '${q}')`) === 0,
    "end: quitting or failing scores nothing and writes no answers",
  );
  ok(QUERIES["mock.open"].run(sql) === null, "open: nothing in progress any more");
}

// ---------------------------------------------------------------------------
console.log("programming screen query (question.code)");
{
  const d = freshDb();
  seed(d, 1);
  for (const id of ["q_c1", "q_c2", "q_c3"]) {
    run(
      d,
      `INSERT INTO questions(id, type, topic_id, marks, difficulty, stem, content_hash, created_at, updated_at)
       VALUES ('${id}', 'code', 'tp_1', 2, 'easy', 'stem ${id}', 'h_${id}', 7, 7)`,
    );
    run(d, `INSERT INTO question_code(question_id, starter) VALUES ('${id}', 'def f():')`);
  }
  const sql = bunSql(d);
  const mid = QUERIES["question.code"].run(sql, { id: "q_c2" }) as CodeQuestionData;
  ok(
    mid.item?.question.id === "q_c2" &&
      (mid.item.detail as { starter: string }).starter === "def f():" &&
      mid.topic?.name === "Topic",
    "question.code: the question, its starter code and topic",
  );
  ok(
    mid.index === 1 && mid.total === 3 && mid.prev === "q_c1" && mid.next === "q_c3",
    "question.code: its place in the list, in the file's order",
  );
  const none = QUERIES["question.code"].run(sql, { id: "q_0" }) as CodeQuestionData;
  ok(none.item === null && none.total === 3, "question.code: a question that isn't a code one is not found");
}
