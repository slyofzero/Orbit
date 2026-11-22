// check.ts section: practice. Run: bun run check
import {
  codeMatches,
  codeState,
  countMatching,
  filterGroups,
  firstLine,
  groupBySubject,
  isSubjectOpen,
  tabEmpty,
  makeMatcher,
  ratingOf,
  topicBar,
  topicBarHint,
  topicMatches,
  type FacetRow,
  type MockCard,
  type PracticeCodeData,
  type PracticeCounts,
  type PracticeMocksData,
  type PracticeTopicsData,
} from "@/lib/practice";
import { QUERIES, type QueryDef } from "@/lib/db/queries";
import { transaction } from "@/lib/db/sql";
import { ok, freshDb, run, bunSql } from "@/scripts/checks/helpers";

// ---------------------------------------------------------------------------
console.log("practice rules (lib/practice.ts)");
{
  ok(ratingOf(null) === "no_idea" && ratingOf("know") === "know", "a topic nobody rated counts as no idea");

  const bar = topicBar({ total: 30, tried: 12, correct: 9 });
  ok(bar.good === 30 && bar.bad === 10, "topic bar: green = right share, red = wrong share");
  ok(
    topicBar({ total: 1000, tried: 1, correct: 1 }).good === 1.5 &&
      topicBar({ total: 4, tried: 0, correct: 0 }).good === 0,
    "topic bar: one answer in a big topic still shows; no answers = no bar",
  );
  ok(
    topicBar({ total: 4, tried: 4, correct: 3 }).good === 75 && topicBar({ total: 4, tried: 4, correct: 3 }).bad === 25,
    "topic bar: green and red never pass 100%",
  );
  ok(
    topicBarHint({ total: 30, tried: 12, correct: 9 }) === "12 answered of 30: 9 right, 3 wrong",
    "topic bar: hover text",
  );

  const t1 = { name: "Eigenvalues", rating: "shaky" as const };
  const t2 = { name: "Bayes' rule", rating: null };
  ok(
    topicMatches(t1, "all", "") &&
      topicMatches(t1, "shaky", " EIGEN ") &&
      !topicMatches(t1, "know", "") &&
      topicMatches(t2, "no_idea", "") &&
      !topicMatches(t2, "all", "eigen"),
    "topics: status tab and search (case and edge spaces ignored); unrated = no idea",
  );

  const g = groupBySubject([
    { subject_id: "a", subject_name: "A", n: 1 },
    { subject_id: "a", subject_name: "A", n: 2 },
    { subject_id: "b", subject_name: "B", n: 3 },
  ]);
  ok(g.length === 2 && g[0].topics.length === 2 && g[1].name === "B", "topics: grouped under their subjects, in order");

  const open = (o: Partial<Parameters<typeof isSubjectOpen>[0]>) =>
    isSubjectOpen({ subjectId: "a", searching: false, chosen: null, planSubjectId: null, firstSubjectId: "a", ...o });
  ok(
    open({}) &&
      !open({ subjectId: "b" }) &&
      open({ subjectId: "b", planSubjectId: "b" }) &&
      !open({ planSubjectId: "b" }) &&
      open({ subjectId: "b", searching: true }) &&
      !open({ chosen: { b: true } }) &&
      open({ chosen: { a: true } }),
    "sections: searching opens all; else your choice; else the plan's subject, else the first",
  );

  const facets: FacetRow[] = [
    { topic_id: "t1", subject_id: "s1", difficulty: "easy", tags: [1], n: 3 },
    { topic_id: "t1", subject_id: "s1", difficulty: "hard", tags: [1, 2], n: 2 },
    { topic_id: "t2", subject_id: "s2", difficulty: "hard", tags: [], n: 4 },
  ];
  const f = (p: string[], topic?: string) => countMatching(facets, makeMatcher(p), topic);
  ok(f([]) === 9 && f([], "t1") === 5, "filter: nothing picked lets everything through");
  ok(
    f(["difficulty:hard"]) === 6 && f(["difficulty:easy", "difficulty:hard"]) === 9,
    "filter: inside one group any picked choice will do",
  );
  ok(
    f(["difficulty:hard", "subject:s1"]) === 2 && f(["tag:2", "tag:9"]) === 2 && f(["subject:s1", "topic:t2"]) === 0,
    "filter: across groups every group with a pick must match",
  );
  ok(f(["difficulty:hard"], "t2") === 4 && f(["tag:1"], "t2") === 0, "filter: counted for one topic");

  const groups = filterGroups(facets, {
    subjects: [
      { id: "s1", name: "Alpha" },
      { id: "s2", name: "Beta" },
      { id: "s3", name: "Empty" },
    ],
    topics: [
      { id: "t1", name: "One" },
      { id: "t2", name: "Two" },
    ],
    tags: [
      { id: 1, name: "trap" },
      { id: 2, name: "formula" },
    ],
  });
  ok(
    groups.map((x) => x.key).join() === "difficulty,subject,topic,tag" &&
      groups[0].choices.map((c) => `${c.label}${c.count}`).join() === "Easy3,Hard6" &&
      groups[1].choices.map((c) => c.value).join() === "subject:s1,subject:s2" &&
      groups[3].choices.map((c) => `${c.label}${c.count}`).join() === "trap5,formula2" &&
      groups[3].label === "Misc",
    "filter groups: difficulty easy→hard, subjects and topics in order, tags most common first, empty ones left out",
  );
  ok(filterGroups([], { subjects: [], topics: [], tags: [] }).length === 0, "filter groups: no questions, no groups");

  ok(
    codeState("correct") === "solved" && codeState("incorrect") === "tried" && codeState(null) === "todo",
    "programming: solved / tried / not tried",
  );
  ok(
    firstLine("![fig](img:h1)\n\n```py\nx = 1\n```\n  Write a function $f$.\nMore") === "Write a function $f$." &&
      firstLine("```\ncode only\n```") === "Programming question" &&
      firstLine("x".repeat(200)).length === 111,
    "programming: first line of the text (pictures and code blocks dropped, cut at 110)",
  );
  const cq = { stem: "Reverse a linked list", topic_name: "Lists", state: "tried" as const, tagNames: ["Pointers"] };
  ok(
    codeMatches(cq, "all", "") &&
      codeMatches(cq, "todo", "linked") &&
      !codeMatches({ ...cq, state: "solved" }, "todo", "") &&
      codeMatches({ ...cq, state: "solved" }, "solved", "lists") &&
      !codeMatches(cq, "solved", "") &&
      codeMatches(cq, "all", "pointer") &&
      !codeMatches(cq, "all", "tree"),
    "programming: to do / solved tabs; search the text, topic and tags",
  );

  const counts = { practice: 0, programming: 0, mocks: 0, mockQuestions: 0 };
  ok(
    tabEmpty("topics", counts) && tabEmpty("programming", counts) && tabEmpty("mocks", counts),
    "tabs: with nothing loaded every tab shows how to load some",
  );
  ok(
    !tabEmpty("topics", { ...counts, practice: 1 }) &&
      tabEmpty("programming", { ...counts, practice: 1 }) &&
      !tabEmpty("programming", { ...counts, programming: 1 }) &&
      !tabEmpty("mocks", { ...counts, mocks: 1 }) &&
      !tabEmpty("mocks", { ...counts, mockQuestions: 3 }) &&
      tabEmpty("mocks", { ...counts, practice: 9 }),
    "tabs: each is filled by its own kind of question",
  );

  // the practice queries over a small bank
  const d = freshDb();
  const s = bunSql(d);
  const q = <R>(name: keyof typeof QUERIES, params?: unknown) =>
    transaction(s, () => (QUERIES[name] as unknown as QueryDef<unknown, R>).run(s, params));
  const none = q<PracticeCounts>("practice.counts");
  ok(
    none.practice === 0 && none.programming === 0 && none.mocks === 0 && none.mockQuestions === 0,
    "practice.counts: nothing loaded yet",
  );
  ok(
    q<PracticeTopicsData>("practice.topics", { today: "2030-01-10" }).topics.length === 0,
    "practice.topics: empty bank",
  );

  run(d, "INSERT INTO subjects(id, name, position) VALUES ('sb_a', 'Alpha', 1), ('sb_b', 'Beta', 2)");
  run(
    d,
    `INSERT INTO topics(id, subject_id, name, position) VALUES
     ('tp_a1', 'sb_a', 'Alpha one', 1), ('tp_a2', 'sb_a', 'Alpha two', 2), ('tp_b1', 'sb_b', 'Beta one', 1)`,
  );
  run(d, "INSERT INTO topic_ratings(topic_id, rating, updated_at) VALUES ('tp_b1', 'know', 0)");
  run(d, "INSERT INTO tags(id, name) VALUES (1, 'trap'), (2, 'formula')");
  const addQ = (id: string, type: string, topic: string, difficulty: string, pool = "practice", retired = "NULL") => {
    run(
      d,
      `INSERT INTO questions(id, type, topic_id, pool, marks, difficulty, stem, content_hash, created_at, updated_at, retired_at)
       VALUES ('${id}', '${type}', '${topic}', '${pool}', 2, '${difficulty}', 'stem ${id}', 'h_${id}', 0, 0, ${retired})`,
    );
    if (type === "mcq")
      run(d, `INSERT INTO question_mcq(question_id, options, correct) VALUES ('${id}', '["a","b"]', 0)`);
    if (type === "code") run(d, `INSERT INTO question_code(question_id, starter) VALUES ('${id}', NULL)`);
  };
  addQ("qa1", "mcq", "tp_a1", "easy");
  addQ("qa2", "mcq", "tp_a1", "easy");
  addQ("qa3", "mcq", "tp_a1", "hard");
  addQ("qa4", "mcq", "tp_a1", "medium");
  addQ("qb1", "mcq", "tp_b1", "hard");
  addQ("qb2", "mcq", "tp_b1", "easy");
  addQ("qx", "mcq", "tp_b1", "easy", "practice", "1"); // retired: never counted
  addQ("qm1", "mcq", "tp_b1", "easy", "mock"); // mock-only: not in practice
  addQ("qc1", "code", "tp_a1", "medium");
  addQ("qc2", "code", "tp_b1", "hard");
  run(d, "INSERT INTO question_tags(question_id, tag_id) VALUES ('qa1', 1), ('qa2', 1), ('qa2', 2), ('qc1', 2)");
  const ans = (qid: string, outcome: string, t: number) =>
    run(d, `INSERT INTO question_answers(question_id, recorded_at, outcome) VALUES ('${qid}', ${t}, '${outcome}')`);
  ans("qa1", "correct", 1);
  ans("qa2", "incorrect", 1);
  ans("qa2", "correct", 2); // latest is right
  ans("qa3", "incorrect", 1);
  ans("qa3", "skipped", 2); // a skip changes nothing: still wrong
  ans("qa4", "skipped", 1); // only skipped: not tried
  ans("qc1", "correct", 1);
  ans("qc1", "incorrect", 2); // latest is wrong: tried, not solved
  ans("qc2", "skipped", 1);

  const c = q<PracticeCounts>("practice.counts");
  ok(
    c.practice === 6 && c.programming === 2 && c.mocks === 0 && c.mockQuestions === 1,
    "practice.counts: practice (no code, no mock-only, no retired), code, mocks, mock-only",
  );

  const pt = q<PracticeTopicsData>("practice.topics", { today: "2030-01-10" });
  const a1 = pt.topics.find((x) => x.id === "tp_a1")!;
  ok(
    pt.topics.map((x) => x.id).join() === "tp_a1,tp_b1" && pt.topics.every((x) => x.id !== "tp_a2"),
    "practice.topics: in the owner's order; a topic without practice questions is left out",
  );
  ok(
    a1.total === 4 && a1.tried === 3 && a1.correct === 2 && a1.rating === null && a1.subject_name === "Alpha",
    "practice.topics: total / tried / right by each question's latest counted answer",
  );
  ok(
    pt.topics[1].rating === "know" && pt.topics[1].total === 2 && pt.topics[1].tried === 0,
    "practice.topics: rating and untouched topic",
  );
  ok(
    pt.facets.reduce((n, x) => n + x.n, 0) === 6 &&
      pt.facets.find((x) => x.topic_id === "tp_a1" && x.difficulty === "easy" && x.tags.join() === "1")?.n === 1 &&
      pt.facets.find((x) => x.tags.join() === "1,2")?.n === 1 &&
      pt.tags.map((x) => x.name).join() === "formula,trap",
    "practice.topics: facets grouped by topic, difficulty and tag set; tags listed",
  );
  const m = makeMatcher(["tag:1", "difficulty:easy"]);
  ok(
    countMatching(pt.facets, m, "tp_a1") === 2 && countMatching(pt.facets, m, "tp_b1") === 0,
    "filter over the real facets",
  );
  ok(pt.next === null, "practice.topics: no plan, no next day");

  run(
    d,
    `INSERT INTO plans(id, name, starts_on, ends_on, is_active, created_at, updated_at)
     VALUES ('pl_1', 'P', '2030-01-01', '2030-01-31', 1, 0, 0)`,
  );
  run(
    d,
    `INSERT INTO plan_days(id, plan_id, on_date, title) VALUES
     (1, 'pl_1', '2030-01-09', 'Yesterday'), (2, 'pl_1', '2030-01-11', 'Next up'), (3, 'pl_1', '2030-01-12', 'Later')`,
  );
  run(
    d,
    `INSERT INTO plan_day_questions(day_id, question_id, position) VALUES
     (1, 'qa1', 1), (2, 'qb1', 1), (2, 'qa3', 2), (2, 'qb2', 3), (3, 'qa1', 1)`,
  );
  const nx = q<PracticeTopicsData>("practice.topics", { today: "2030-01-10" }).next!;
  ok(
    nx.on_date === "2030-01-11" && nx.title === "Next up" && nx.topics.map((x) => x.id).join() === "tp_b1,tp_a1",
    "practice.topics: the next planned day with linked questions, its topics in the day's order",
  );
  ok(
    q<PracticeTopicsData>("practice.topics", { today: "2030-01-11" }).next!.on_date === "2030-01-11" &&
      q<PracticeTopicsData>("practice.topics", { today: "2030-01-13" }).next === null,
    "practice.topics: today counts; after the last linked day there is none",
  );

  const pg = q<PracticeCodeData>("practice.programming");
  ok(
    pg.questions.map((x) => `${x.id}:${x.state}`).join() === "qc1:tried,qc2:todo" &&
      pg.questions[0].tags.join() === "2" &&
      pg.questions[0].subject_name === "Alpha" &&
      pg.tags.length === 2,
    "practice.programming: code questions in order, tried / not tried by the latest counted answer, tags",
  );
  ans("qc1", "correct", 3);
  ok(
    q<PracticeCodeData>("practice.programming").questions[0].state === "solved",
    "practice.programming: a right answer after a wrong one = solved",
  );

  let pm = q<PracticeMocksData>("practice.mocks");
  ok(
    pm.mocks.length === 0 &&
      pm.history.length === 0 &&
      pm.practiceQuestions === 6 &&
      pm.topics.map((x) => x.id).join() === "tp_a1,tp_b1" &&
      pm.topics[1].rating === "know",
    "practice.mocks: no mocks yet; topics with practice questions for the generated tests",
  );
  run(
    d,
    "INSERT INTO mocks(id, name, minutes, position, created_at, updated_at) VALUES ('mk_1', 'Mock one', 60, 1, 0, 0)",
  );
  run(d, "INSERT INTO mock_sections(id, mock_id, name, position) VALUES (1, 'mk_1', 'Section', 1)");
  addQ("qm2", "mcq", "tp_b1", "hard", "mock");
  run(d, "INSERT INTO mock_items(section_id, question_id, position) VALUES (1, 'qm1', 1), (1, 'qm2', 2)");
  const att = (id: string, status: string, started: number, score: string, max: string, reason: string) =>
    run(
      d,
      `INSERT INTO mock_attempts(id, mock_id, status, sections, minutes, started_at, ended_at, score, max_score, failed_reason)
       VALUES ('${id}', 'mk_1', '${status}', '[{"name":"Section"}]', 60, ${started}, ${started + 1}, ${score}, ${max}, ${reason})`,
    );
  att("at_1", "submitted", 100, "2.5", "4", "NULL");
  att("at_2", "submitted", 200, "3.5", "4", "NULL");
  att("at_3", "failed", 300, "NULL", "NULL", "'left full screen'");
  run(
    d,
    "INSERT INTO mock_attempt_items(attempt_id, question_id, section, position) VALUES ('at_2', 'qm1', 0, 0), ('at_2', 'qm2', 0, 1)",
  );
  pm = q<PracticeMocksData>("practice.mocks");
  const card = pm.mocks[0] as MockCard;
  ok(
    card.name === "Mock one" && card.questions === 2 && card.marks === 4 && card.attempts === 2 && card.best === 3.5,
    "practice.mocks: a mock's questions, marks, submitted attempts and best score (failed ones don't count)",
  );
  ok(
    pm.history.map((x) => `${x.id}:${x.status}`).join() === "at_3:failed,at_2:submitted,at_1:submitted" &&
      pm.history[1].questions === 2 &&
      pm.history[0].score === null,
    "practice.mocks: every attempt, newest first",
  );
  ok(q<PracticeCounts>("practice.counts").mocks === 1, "practice.counts: counts the mock");
}
