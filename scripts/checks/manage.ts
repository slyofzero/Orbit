// check.ts section: Manage pack (lib/manage.ts rules, lib/prompts/editPrompt.ts, lib/db/queries/manage.ts).
// Run: bun run check
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  changeType,
  checkForm,
  checkMock,
  checkSectionName,
  DELETE_MOCKS_PHRASE,
  dropOption,
  moveIn,
  emptyForm,
  exportFile,
  fileNameOf,
  formOf,
  friendlyError,
  isDeletePhrase,
  emptyPhrase,
  isPhrase,
  pageOf,
  previewText,
  toggleRight,
  type QuestionForm,
} from "@/lib/manage";
import { editBoxes, editPrompt } from "@/lib/prompts/editPrompt";
import { parseQuestionFile } from "@/lib/questionFile";
import { QUERIES, type QueryDef, type ResultOf } from "@/lib/db/queries";
import { transaction } from "@/lib/db/sql";
import type { QuestionDetail } from "@/lib/questions";
import { ok, freshDb, run, bunSql, count } from "@/scripts/checks/helpers";

const sample = readFileSync(join(import.meta.dir, "..", "..", "samples", "questions", "sample-topics.json"), "utf8");
const mcqForm = (over: Partial<QuestionForm> = {}): QuestionForm => ({
  ...emptyForm("tp_x"),
  difficulty: "easy",
  text: "What is $1 + 1$?",
  options: ["$1$", "$2$", "$3$"],
  picked: [1],
  explanation: "Count.",
  ...over,
});

// ---------------------------------------------------------------------------
console.log("manage pack rules (lib/manage.ts)");
{
  const r = checkForm(mcqForm(), "Maths", "Sums", "practice");
  ok(r.question?.type === "mcq" && r.errors.length === 0, "form: a good mcq passes the importer's checks");
  ok(
    r.question?.type === "mcq" &&
      r.question.correct === 1 &&
      r.question.subject === "Maths" &&
      r.question.pool === "practice",
    "form: the ticked option, subject and pool carry over",
  );
  const noDiff = checkForm(mcqForm({ difficulty: "" }), "Maths", "Sums", "practice");
  ok(!noDiff.question && noDiff.errors[0].startsWith("Pick a difficulty"), "form: a difficulty must be picked");
  const blank = checkForm(mcqForm({ options: ["$1$", ""] }), "Maths", "Sums", "practice");
  ok(
    !blank.question && blank.errors.some((e) => e.startsWith("The options must be")),
    "form: an empty option is refused",
  );
  const noText = checkForm(mcqForm({ text: " " }), "Maths", "Sums", "practice");
  ok(noText.errors.includes("Write the question."), "form: an empty question is refused in plain words");
  const nat = checkForm(mcqForm({ type: "nat", natValue: "abc" }), "Maths", "Sums", "practice");
  ok(
    nat.errors.some((e) => e.startsWith("The right answer must be a number")),
    "form: NAT answer must be a number",
  );
  const natOk = checkForm(mcqForm({ type: "nat", natValue: "2.5", natTol: "0.1" }), "M", "S", "mock");
  ok(natOk.question?.type === "nat" && natOk.question.value === 2.5 && natOk.question.pool === "mock", "form: NAT");
  const str = checkForm(mcqForm({ type: "str", strAnswers: "I,D,B\n\nIDB", strMatch: "list" }), "M", "S", "practice");
  ok(str.question?.type === "str" && str.question.accepted.length === 2, "form: text answers, one per line");
  const code = checkForm(mcqForm({ type: "code", starter: "  x = 1\n" }), "M", "S", "practice");
  ok(code.question?.type === "code" && code.question.starter === "  x = 1\n", "form: code keeps its starter as typed");
  ok(
    checkForm(mcqForm({ tags: "a, b, c, d, e, f, g, h, i" }), "M", "S", "practice").errors.includes(
      "Use at most 8 tags.",
    ),
    "form: at most 8 tags",
  );
  ok(
    friendlyError('questions[0] ("x").marks must be a number above 0 (and at most 100).') ===
      "Marks must be a number above 0 (and at most 100).",
    "errors: the importer's field names become the editor's",
  );

  const m1 = changeType(mcqForm({ type: "msq", picked: [0, 2] }), "mcq");
  ok(m1.picked.length === 1 && m1.picked[0] === 0, "type: switching to mcq keeps one tick");
  const msq = { ...mcqForm(), type: "msq" as const, picked: [1] };
  ok(toggleRight(toggleRight(msq, 0), 1).picked.join() === "0", "tick: msq toggles");
  ok(toggleRight(mcqForm(), 2).picked.join() === "2", "tick: mcq picks one");
  const dropped = dropOption({ ...msq, picked: [0, 2] }, 1);
  ok(dropped.options.length === 2 && dropped.picked.join() === "0,1", "options: removing one moves the ticks up");
  ok(previewText("Short $x$") === "Short $x$", "preview: short text as is");
  ok(
    previewText("## Find\n\n$$\\int_0^1 x\\,dx$$\n```py\nprint(1)\n```") === "Find $\\int_0^1 x\\,dx$ [code]",
    "preview: one line, display maths inline, code shown as [code]",
  );
  const cutMaths = previewText("aaaa $x + y + z$ bbbb", 10);
  ok(cutMaths === "aaaa…", "preview: never cuts inside maths");
  ok(previewText("one two three four five six", 12) === "one two…", "preview: cuts at a word");
  ok(
    fileNameOf("Linear algebra!") === "linear-algebra.json" && fileNameOf("¿¿") === "orbit-questions.json",
    "file name",
  );

  const boxes = editBoxes(mcqForm()).map((b) => b.name);
  ok(boxes.join("|") === "QUESTION|OPTION A|OPTION B|OPTION C|EXPLANATION", "edit prompt: one box per field");
  ok(
    editBoxes(mcqForm({ type: "code" })).some((b) => b.name === "STARTER CODE"),
    "edit prompt: code has starter code",
  );
  const prompt = editPrompt(mcqForm());
  ok(
    prompt.includes("MARKED AS RIGHT: B") && prompt.includes("Send exactly 5 code blocks") && !/GATE/.test(prompt),
    "edit prompt: names the right option, counts the boxes, no exam names",
  );
}

// ---------------------------------------------------------------------------
console.log("manage pack queries (lib/db/queries/manage.ts)");
{
  const d = freshDb();
  const s = bunSql(d);
  const q = <N extends keyof typeof QUERIES>(name: N, params?: unknown) =>
    transaction(s, () => (QUERIES[name] as unknown as QueryDef<unknown, ResultOf<N>>).run(s, params));

  const imp = q("pack.import", { text: sample, fileName: "sample.json", fileHash: "h1" }) as {
    ok: boolean;
    packId: string;
  };
  ok(imp.ok, "setup: the sample pack imports");
  const ov = q("manage.overview");
  ok(ov.counts.total === 10 && ov.counts.packs === 1 && ov.topics.length === 4, "overview: counts and topics");
  ok(ov.topics.every((t) => t.questions > 0) && ov.subjects.length >= 1, "overview: every topic is in use");

  const all = q("manage.questions", {
    search: "",
    bank: "practice",
    mockId: null,
    topicId: null,
    limit: 40,
    offset: 0,
  });
  ok(all.rows.length === 10 && all.matched === 10 && all.total === 10, "questions: every question");
  const first = all.rows[0];
  const byId = q("manage.questions", {
    search: first.id.toUpperCase(),
    bank: "practice",
    mockId: null,
    topicId: null,
    limit: 40,
    offset: 0,
  });
  ok(byId.rows[0].id === first.id && byId.matched === 1, "questions: find by id (any case)");
  const word = q("manage.questions", {
    search: "orthogonal",
    bank: "practice",
    mockId: null,
    topicId: null,
    limit: 40,
    offset: 0,
  });
  ok(
    word.matched >= 1 && word.rows.every((r) => r.stem.toLowerCase().includes("orthogonal")),
    "questions: find by text",
  );
  const topicId = ov.topics[0].id;
  const inTopic = q("manage.questions", { search: "", bank: "practice", mockId: null, topicId, limit: 40, offset: 0 });
  ok(inTopic.matched === ov.topics[0].questions, "questions: filter by topic");
  ok(
    q("manage.questions", { search: "", bank: "practice", mockId: null, topicId: null, limit: 3, offset: 0 }).rows
      .length === 3,
    "questions: limit",
  );
  const p2 = q("manage.questions", { search: "", bank: "practice", mockId: null, topicId: null, limit: 4, offset: 8 });
  ok(
    p2.rows.length === 2 && p2.rows[0].id === all.rows[8].id && p2.matched === 10,
    "questions: a later page, same order",
  );
  const pg = pageOf(45, 1, 20);
  ok(pg.pages === 3 && pg.offset === 20 && pg.first === 21 && pg.last === 40, "pager: page 2 of 3 shows 21–40");
  ok(pageOf(45, 9, 20).page === 2 && pageOf(45, 9, 20).last === 45, "pager: past the end falls back to the last page");
  ok(pageOf(0, 0, 20).pages === 1 && pageOf(0, 0, 20).first === 0, "pager: an empty list is one empty page");

  // the editor: open, save unchanged, add, duplicate, type
  const one = q("manage.question", { id: first.id })!;
  ok(one.question.id === first.id && one.place === null && one.answers === 0, "question: loads for the editor");
  const form = formOf(one.question, one.detail, one.tags);
  const same = q("manage.saveQuestion", { id: first.id, form, target: null });
  ok(same.ok, "save: an unchanged question saves");
  const after = q("manage.question", { id: first.id })!;
  ok(after.question.content_hash === one.question.content_hash, "save: nothing changed, same hash");
  ok(
    q("manage.saveQuestion", {
      id: first.id,
      form: { ...form, type: form.type === "nat" ? "mcq" : "nat" },
      target: null,
    }).ok === false,
    "save: a saved question keeps its type",
  );
  const dup = q("manage.saveQuestion", { id: null, form, target: null });
  ok(!dup.ok && dup.errors[0].includes(first.id), "add: the same question twice is refused");
  const added = q("manage.saveQuestion", { id: null, form: mcqForm({ topicId, tags: "trap, formula" }), target: null });
  ok(
    added.ok && count(d, "SELECT count(*) AS n FROM questions WHERE retired_at IS NULL") === 11,
    "add: a new question",
  );
  const newId = added.ok ? added.id : "";
  ok(q("manage.question", { id: newId })!.tags.join() === "formula,trap", "add: tags saved");
  const edited = q("manage.saveQuestion", {
    id: newId,
    form: mcqForm({ topicId, text: "What is $2 + 2$?", options: ["$4$", "$5$"], picked: [0] }),
    target: null,
  });
  const reloaded = q("manage.question", { id: newId })!;
  ok(
    edited.ok &&
      reloaded.question.stem === "What is $2 + 2$?" &&
      (reloaded.detail as { options: string[] }).options.length === 2 &&
      reloaded.tags.length === 0,
    "edit: text, options and tags replaced",
  );
  ok(
    !q("manage.saveQuestion", { id: null, form: mcqForm({ topicId: "nope" }), target: null }).ok,
    "add: the topic must exist",
  );

  // into a mock and back
  run(d, `INSERT INTO mocks(id, name, minutes, created_at, updated_at) VALUES ('mk_1', 'Mock one', 60, 0, 0)`);
  const toMock = q("manage.saveQuestion", {
    id: newId,
    form: formOf(reloaded.question, reloaded.detail, []),
    target: { mockId: "mk_1", sectionId: null, newSection: "Part A" },
  });
  const placed = q("manage.question", { id: newId })!;
  ok(
    toMock.ok && placed.place?.sectionName === "Part A" && placed.question.pool === "mock",
    "mock: new section, moved in",
  );
  ok(
    !q("manage.saveQuestion", {
      id: null,
      form: mcqForm({ topicId, text: "x?" }),
      target: { mockId: "mk_1", sectionId: null, newSection: "part a" },
    }).ok,
    "mock: a section name is used once per mock",
  );
  const inMock = q("manage.questions", {
    search: "",
    bank: "mock",
    mockId: "mk_1",
    topicId: null,
    limit: 40,
    offset: 0,
  });
  ok(inMock.matched === 1 && inMock.rows[0].place === "Mock one · Part A", "questions: filter by mock, place shown");
  ok(
    q("manage.questions", { search: "", bank: "practice", mockId: null, topicId: null, limit: 40, offset: 0 })
      .matched === 10,
    "questions: practice only",
  );
  const back = q("manage.saveQuestion", { id: newId, form: formOf(placed.question, placed.detail, []), target: null });
  ok(
    back.ok &&
      q("manage.question", { id: newId })!.place === null &&
      count(d, "SELECT count(*) AS n FROM mock_items") === 0,
    "mock: back to Practice leaves the mock",
  );

  // remove: deleted when unused, retired when answered
  const del = q("manage.removeQuestion", { id: newId });
  ok(
    !del.retired && count(d, `SELECT count(*) AS n FROM questions WHERE id = '${newId}'`) === 0,
    "remove: unused is deleted",
  );
  q("question.record", { answers: [{ questionId: first.id, outcome: "correct", timeMs: 1000 }] });
  const ret = q("manage.removeQuestion", { id: first.id });
  ok(
    ret.retired &&
      count(d, `SELECT count(*) AS n FROM questions WHERE id = '${first.id}' AND retired_at IS NOT NULL`) === 1 &&
      count(d, "SELECT count(*) AS n FROM question_answers") === 1,
    "remove: answered is retired, the answer stays",
  );
  ok(q("manage.question", { id: first.id }) === null, "remove: gone from the editor");

  // topics and subjects
  const sid = ov.subjects[0].id;
  const t1 = q("manage.addTopic", { subjectId: sid, newSubject: "", name: "Fresh topic" });
  ok(t1.ok, "topic: added");
  ok(!q("manage.addTopic", { subjectId: sid, newSubject: "", name: "fresh TOPIC" }).ok, "topic: same name refused");
  const t2 = q("manage.addTopic", { subjectId: null, newSubject: "New subject", name: "Its topic" });
  ok(t2.ok && q("manage.overview").subjects.some((x) => x.name === "New subject"), "topic: in a new subject");
  const tid = t1.ok ? t1.id : "";
  ok(q("manage.renameTopic", { id: tid, name: "Renamed" }).ok, "topic: renamed");
  ok(
    !q("manage.renameTopic", { id: tid, name: ov.topics.find((t) => t.subject_id === sid)!.name }).ok,
    "topic: rename clash refused",
  );
  q("manage.rateTopic", { id: tid, rating: "shaky" });
  q("manage.rateTopic", { id: tid, rating: "know" });
  ok(
    count(d, `SELECT count(*) AS n FROM topic_ratings WHERE topic_id = '${tid}' AND rating = 'know'`) === 1,
    "topic: rated (upsert)",
  );
  ok(!q("manage.removeTopic", { id: topicId }).ok, "topic: in use can't be removed");
  ok(
    q("manage.removeTopic", { id: tid }).ok && count(d, `SELECT count(*) AS n FROM topics WHERE id = '${tid}'`) === 0,
    "topic: unused is deleted",
  );
  ok(!q("manage.renameSubject", { id: sid, name: "New subject" }).ok, "subject: name clash refused");
  ok(q("manage.renameSubject", { id: sid, name: "Mathematics" }).ok, "subject: renamed");

  // export → import again
  const ex = q("manage.export", { packId: null })!;
  const parsed = parseQuestionFile(JSON.stringify(ex.file));
  ok(parsed.file?.questions.length === 9 && !ex.tooBig, "export: the bank as a file the importer accepts");
  const d2 = freshDb();
  const s2 = bunSql(d2);
  const r2 = transaction(s2, () =>
    (QUERIES["pack.import"] as unknown as QueryDef<unknown, { ok: boolean; total: number }>).run(s2, {
      text: JSON.stringify(ex.file),
      fileName: "x.json",
      fileHash: "h2",
    }),
  );
  ok(r2.ok && r2.total === 9, "export: imports into an empty Orbit");
  const hashes = (x: typeof d) =>
    (x.query("SELECT content_hash FROM questions ORDER BY content_hash").all() as { content_hash: string }[])
      .map((r) => r.content_hash)
      .join();
  run(d, "DELETE FROM question_answers");
  ok(
    hashes(d2) ===
      hashes(d)
        .split(",")
        .filter((h) => h !== one.question.content_hash)
        .join(),
    "export: every question comes back the same",
  );

  const withMock = exportFile(
    "P",
    [
      {
        id: "q1",
        subject: "S",
        topic: "T",
        question: {
          type: "nat",
          difficulty: "easy",
          marks: 2,
          negative_marks: 0,
          stem: "s",
          explanation: null,
          pool: "mock",
        },
        detail: { question_id: "q1", value: 3, tolerance: 0 } as QuestionDetail,
        tags: [],
      },
    ],
    [
      {
        name: "M",
        instructions: null,
        minutes: 30,
        full_screen: true,
        sections: [
          { name: "A", minutes: null, questions: ["q1", "gone"] },
          { name: "Empty", minutes: null, questions: [] },
        ],
      },
    ],
  );
  const pm = parseQuestionFile(withMock);
  ok(
    pm.file?.mocks.length === 1 && pm.file.mocks[0].sections.length === 1 && pm.file.mocks[0].full_screen,
    "export: mocks name their questions; empty sections left out",
  );

  // packs
  const packs = q("manage.packs");
  ok(packs.length === 1 && packs[0].questions === 9, "packs: listed with what is left");
  ok(q("manage.renamePack", { id: imp.packId, name: "Renamed pack" }).ok, "packs: renamed");
  const gone = q("manage.removePack", { id: imp.packId });
  ok(
    gone.questions === 9 &&
      count(d, "SELECT count(*) AS n FROM questions WHERE retired_at IS NULL") === 0 &&
      count(d, "SELECT count(*) AS n FROM packs") === 0,
    "packs: removing one removes its questions",
  );
  ok(
    (q("pack.import", { text: sample, fileName: "sample.json", fileHash: "h1" }) as { ok: boolean }).ok,
    "packs: the same file imports again afterwards",
  );
}

// ---------------------------------------------------------------------------
console.log("manage pack: delete the whole pack (manage.deleteAll)");
{
  ok(
    isDeletePhrase("delete pack") &&
      isDeletePhrase("  Delete Pack ") &&
      !isDeletePhrase("delete") &&
      !isDeletePhrase(""),
    'phrase: only "delete pack" (any case, spaces around) confirms',
  );
  const d = freshDb();
  const s = bunSql(d);
  const q = <N extends keyof typeof QUERIES>(name: N, params?: unknown) =>
    transaction(s, () => (QUERIES[name] as unknown as QueryDef<unknown, ResultOf<N>>).run(s, params));
  q("pack.import", { text: sample, fileName: "sample.json", fileHash: "h1" });
  const qid = (d.query("SELECT id FROM questions LIMIT 1").get() as { id: string }).id;
  run(
    d,
    `INSERT INTO plans(id, name, starts_on, ends_on, is_active, created_at, updated_at)
       VALUES ('pl_1', 'Plan', '2020-01-01', '2020-01-10', 1, 0, 0);
     INSERT INTO plan_days(id, plan_id, on_date) VALUES (1, 'pl_1', '2020-01-02');
     INSERT INTO plan_tasks(id, day_id, position, body) VALUES (1, 1, 1, 'Read');
     INSERT INTO plan_task_ticks(task_id, done_at) VALUES (1, 5);
     INSERT INTO plan_day_questions(day_id, question_id, position) VALUES (1, '${qid}', 1);
     INSERT INTO milestones(plan_id, name, on_date) VALUES ('pl_1', 'Exam', '2020-01-10');
     INSERT INTO topic_ratings(topic_id, rating, updated_at) SELECT id, 'know', 0 FROM topics LIMIT 1;`,
  );
  q("question.record", { answers: [{ questionId: qid, outcome: "correct", timeMs: 900 }] });
  ok(count(d, "SELECT count(*) AS n FROM plan_question_ticks") === 1, "setup: an answer ticked the plan link");
  const gone = q("manage.deleteAll");
  ok(gone.questions === 10 && gone.packs === 1 && gone.mocks === 0, "delete: says what it deleted");
  const empty = [
    "packs",
    "questions",
    "question_mcq",
    "question_tags",
    "tags",
    "subjects",
    "topics",
    "topic_ratings",
    "mocks",
    "question_answers",
    "question_stats",
    "plan_day_questions",
    "plan_question_ticks",
    "images",
  ];
  ok(
    empty.every((t) => count(d, `SELECT count(*) AS n FROM ${t}`) === 0),
    "delete: every question table is empty",
  );
  ok(
    count(d, "SELECT count(*) AS n FROM plans") === 1 &&
      count(d, "SELECT count(*) AS n FROM plan_tasks") === 1 &&
      count(d, "SELECT count(*) AS n FROM plan_task_ticks") === 1 &&
      count(d, "SELECT count(*) AS n FROM milestones") === 1,
    "delete: the plan, its tasks, ticks and milestones stay",
  );
  ok(
    count(d, "SELECT questions_total AS n FROM plan_day_progress WHERE day_id = 1") === 0 &&
      count(d, "SELECT tasks_done AS n FROM plan_day_progress WHERE day_id = 1") === 1,
    "delete: the day's progress no longer counts the question",
  );
  ok(
    (q("pack.import", { text: sample, fileName: "sample.json", fileHash: "h1" }) as { ok: boolean }).ok,
    "delete: the same file imports again",
  );
}

// ---------------------------------------------------------------------------
console.log("manage pack: the three banks and emptying one (manage.emptyBank)");
{
  ok(
    emptyPhrase("mock") === "empty mock" &&
      isPhrase(" Empty Practice ", emptyPhrase("practice")) &&
      !isPhrase("empty", emptyPhrase("practice")),
    'phrase: each bank has its own "empty …" phrase',
  );
  const d = freshDb();
  const s = bunSql(d);
  const q = <N extends keyof typeof QUERIES>(name: N, params?: unknown) =>
    transaction(s, () => (QUERIES[name] as unknown as QueryDef<unknown, ResultOf<N>>).run(s, params));
  q("pack.import", { text: sample, fileName: "sample.json", fileHash: "h1" });
  const topicId = q("manage.overview").topics[0].id;
  q("manage.saveQuestion", { id: null, form: mcqForm({ topicId, type: "code", starter: "x = 1" }), target: null });
  run(d, `INSERT INTO mocks(id, name, minutes, created_at, updated_at) VALUES ('mk_1', 'Mock one', 60, 0, 0)`);
  q("manage.saveQuestion", {
    id: null,
    form: mcqForm({ topicId, text: "Mock only?" }),
    target: { mockId: "mk_1", sectionId: null, newSection: "A" },
  });
  const list = (bank: string) =>
    q("manage.questions", { search: "", bank, mockId: null, topicId: null, limit: 100, offset: 0 });
  const ids = (bank: string) => list(bank).rows.map((r) => r.id);
  const all = [...ids("practice"), ...ids("programming"), ...ids("mock")];
  ok(
    ids("practice").length === 10 && ids("programming").length === 1 && ids("mock").length === 1,
    "banks: practice 10, programming 1, mock 1",
  );
  ok(all.length === 12 && new Set(all).size === 12, "banks: every question in exactly one bank");
  ok(list("programming").rows[0].type === "code" && list("programming").total === 1, "banks: programming = code");
  // a practice question also used by the mock still shows only in Practice
  run(
    d,
    `INSERT INTO mock_items(section_id, question_id, position)
       SELECT (SELECT id FROM mock_sections LIMIT 1), '${ids("practice")[0]}', 9`,
  );
  ok(
    ids("mock").length === 1 && ids("practice").length === 10,
    "banks: a practice question in a mock stays in Practice",
  );

  const progAns = ids("practice")[1];
  q("question.record", { answers: [{ questionId: progAns, outcome: "correct", timeMs: 500 }] });
  const e1 = q("manage.emptyBank", { bank: "programming" });
  ok(e1.questions === 1 && ids("programming").length === 0 && ids("practice").length === 10, "empty: programming only");
  const e2 = q("manage.emptyBank", { bank: "mock" });
  ok(
    e2.questions === 1 &&
      e2.mocks === 1 &&
      ids("mock").length === 0 &&
      ids("practice").length === 10 &&
      count(d, "SELECT count(*) AS n FROM mocks WHERE retired_at IS NULL") === 0,
    "empty: mock removes the mocks and mock questions, not the practice question they used",
  );
  const e3 = q("manage.emptyBank", { bank: "practice" });
  ok(
    e3.questions === 10 && ids("practice").length === 0 && count(d, "SELECT count(*) AS n FROM question_answers") === 1,
    "empty: practice; your past answers stay",
  );
  ok(count(d, "SELECT count(*) AS n FROM packs") === 0, "empty: a pack left with nothing is removed");
  ok(
    (q("pack.import", { text: sample, fileName: "sample.json", fileHash: "h1" }) as { ok: boolean }).ok &&
      ids("practice").length === 10,
    "empty: the same file imports again",
  );
}

// ---------------------------------------------------------------------------
console.log("manage pack: mock tests (manage.mocks, manage.mock, sections, question order)");
{
  const good = checkMock({ name: " Mock 3 ", minutes: "180", instructions: "  " });
  ok(good.ok && good.name === "Mock 3" && good.minutes === 180 && good.instructions === null, "mock: details cleaned");
  ok(
    !checkMock({ name: "", minutes: "60", instructions: "" }).ok &&
      !checkMock({ name: "M", minutes: "0", instructions: "" }).ok &&
      !checkMock({ name: "M", minutes: "1.5", instructions: "" }).ok &&
      !checkMock({ name: "M", minutes: "601", instructions: "" }).ok &&
      !checkMock({ name: "M", minutes: "", instructions: "" }).ok,
    "mock: a name and whole minutes from 1 to 600",
  );
  ok(!checkSectionName("  ").ok && checkSectionName(" A ").ok, "section: needs a name");
  ok(
    isPhrase(" Delete All Mocks ", DELETE_MOCKS_PHRASE) && !isPhrase("delete", DELETE_MOCKS_PHRASE),
    'phrase: "delete all mocks" confirms deleting every mock test',
  );
  ok(
    moveIn([1, 2, 3], 0, 1).join() === "2,1,3" &&
      moveIn([1, 2, 3], 0, -1).join() === "1,2,3" &&
      moveIn([1, 2, 3], 2, 1).join() === "1,2,3" &&
      moveIn([1, 2, 3], -1, 1).join() === "1,2,3",
    "moveIn: swaps with a neighbour, never past the ends",
  );

  const d = freshDb();
  const s = bunSql(d);
  const q = <N extends keyof typeof QUERIES>(name: N, params?: unknown) =>
    transaction(s, () => (QUERIES[name] as unknown as QueryDef<unknown, ResultOf<N>>).run(s, params));
  q("pack.import", { text: sample, fileName: "sample.json", fileHash: "h1" });
  const topicId = q("manage.overview").topics[0].id;

  const bad = q("manage.addMock", { name: "Mock", minutes: "abc" });
  ok(!bad.ok, "add: bad minutes refused");
  const a = q("manage.addMock", { name: "Mock A", minutes: "90" });
  const b = q("manage.addMock", { name: "Mock B", minutes: "60" });
  ok(a.ok && b.ok, "add: two mocks");
  if (!a.ok || !b.ok) throw new Error("setup failed");
  ok(
    q("manage.mocks")
      .map((m) => m.name)
      .join() === "Mock A,Mock B",
    "list: in the order they were added",
  );

  const saved = q("manage.saveMock", {
    id: a.id,
    name: "Mock A+",
    minutes: "120",
    instructions: "Read **all** of it.",
    fullScreen: true,
  });
  const card = q("manage.mocks")[0];
  ok(
    saved.ok && card.name === "Mock A+" && card.minutes === 120 && card.full_screen && card.instructions !== null,
    "save: name, minutes, instructions, full screen",
  );

  const s1 = q("manage.addSection", { mockId: a.id, name: "Part 1" });
  const s2 = q("manage.addSection", { mockId: a.id, name: "Part 2" });
  ok(s1.ok && s2.ok && !q("manage.addSection", { mockId: a.id, name: "part 1" }).ok, "sections: unique names");
  if (!s1.ok || !s2.ok) throw new Error("setup failed");
  const addQ = (text: string, sectionId: number) => {
    const r = q("manage.saveQuestion", {
      id: null,
      form: mcqForm({ topicId, text }),
      target: { mockId: a.id, sectionId, newSection: "" },
    });
    if (!r.ok) throw new Error(r.errors.join("; "));
    return r.id;
  };
  const x = addQ("First?", s1.id);
  const y = addQ("Second?", s1.id);
  const z = addQ("Third?", s2.id);
  const practiceId = q("manage.questions", {
    search: "",
    bank: "practice",
    mockId: null,
    topicId: null,
    limit: 1,
    offset: 0,
  }).rows[0].id;
  run(d, `INSERT INTO mock_items(section_id, question_id, position) VALUES (${s2.id}, '${practiceId}', 99)`);

  const order = () =>
    q("manage.mock", { id: a.id })!
      .sections.map((sec) => `${sec.name}:${sec.questions.map((i) => i.id).join("+")}`)
      .join(" | ");
  ok(order() === `Part 1:${x}+${y} | Part 2:${z}+${practiceId}`, "detail: sections and questions in order");
  q("manage.moveItem", { sectionId: s1.id, questionId: y, dir: -1 });
  q("manage.moveSection", { id: s2.id, dir: -1 });
  ok(order() === `Part 2:${z}+${practiceId} | Part 1:${y}+${x}`, "move: question up, section up");
  q("manage.moveSection", { id: s2.id, dir: -1 });
  ok(order().startsWith("Part 2"), "move: the first section can't go higher");

  ok(q("manage.renameSection", { id: s1.id, name: "Part One" }).ok, "rename: section renamed");
  ok(!q("manage.renameSection", { id: s1.id, name: "PART 2" }).ok, "rename: refused when the name is taken");

  // start an attempt: the exam runs the order on screen
  const attemptId = q("mock.start", { mockId: a.id });
  const ran = (
    d.query(`SELECT question_id FROM mock_attempt_items WHERE attempt_id = ? ORDER BY position`).all(attemptId) as {
      question_id: string;
    }[]
  ).map((r) => r.question_id);
  ok(ran.join() === [z, practiceId, y, x].join(), "exam: runs the questions in the order shown");
  run(d, `UPDATE mock_attempts SET status = 'abandoned', ended_at = 1`);

  const r1 = q("manage.removeItem", { sectionId: s2.id, questionId: practiceId });
  ok(
    !r1.deleted &&
      count(d, `SELECT count(*) AS n FROM questions WHERE id = '${practiceId}' AND retired_at IS NULL`) === 1,
    "remove: a practice question only leaves the mock",
  );
  const r2 = q("manage.removeItem", { sectionId: s1.id, questionId: x });
  ok(
    r2.deleted &&
      r2.retired &&
      count(d, `SELECT count(*) AS n FROM questions WHERE id = '${x}' AND retired_at IS NULL`) === 0,
    "remove: a mock-only question is deleted (retired: an attempt used it)",
  );
  const r3 = q("manage.removeSection", { id: s2.id });
  ok(r3.questions === 1 && order() === `Part One:${y}`, "section: deleted with its mock-only question");

  ok(
    !q("manage.saveMock", { id: a.id, name: "M", minutes: "0", instructions: "", fullScreen: false }).ok,
    "save: checked",
  );
  q("manage.removeMock", { id: a.id });
  ok(
    q("manage.mock", { id: a.id }) === null &&
      q("manage.mocks").length === 1 &&
      count(d, `SELECT count(*) AS n FROM mocks WHERE id = '${a.id}'`) === 1 &&
      count(d, `SELECT count(*) AS n FROM questions WHERE id = '${y}' AND retired_at IS NULL`) === 0,
    "delete mock: retired (it has an attempt), its questions go",
  );
  q("manage.removeMock", { id: b.id });
  ok(count(d, `SELECT count(*) AS n FROM mocks WHERE id = '${b.id}'`) === 0, "delete mock: never taken = deleted");
}
