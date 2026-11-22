// check.ts section: questionFile. Run: bun run check
import { tabEmpty, type PracticeCounts } from "@/lib/practice";
import { exampleQuestions, questionsPrompt } from "@/lib/prompts/questionsPrompt";
import { PACK_FORMAT, bankRefErrors, parseQuestionFile, questionHash, questionSummary } from "@/lib/questionFile";
import { QUERIES, type QueryDef } from "@/lib/db/queries";
import { transaction } from "@/lib/db/sql";
import { ok, freshDb, bunSql } from "@/scripts/checks/helpers";

console.log("question file (lib/questionFile.ts)");
{
  const TABS = ["pack", "topics", "programming", "mocks"] as const;
  for (const kind of TABS) {
    const ex = parseQuestionFile(JSON.stringify(exampleQuestions(kind)));
    ok(
      ex.file !== null && ex.errors.length === 0 && ex.warnings.length === 0,
      `the ${kind} prompt's example passes the importer with no warnings`,
    );
    const pr = questionsPrompt(kind);
    ok(
      pr.includes(JSON.stringify(exampleQuestions(kind), null, 2)) && pr.includes(PACK_FORMAT),
      `the ${kind} prompt contains its example and the format name`,
    );
    ok(!/\b(GATE|JEE|NEET|UPSC|SAT|GRE)\b/.test(pr), `the ${kind} prompt names no particular exam`);
    const sum = questionSummary(ex.file!);
    if (kind === "pack") {
      const lean = parseQuestionFile(JSON.stringify({ ...exampleQuestions("topics"), mocks: [] }));
      ok(
        lean.file !== null && lean.errors.length === 0 && pr.includes('"mocks": []'),
        "the pack prompt says to leave unwanted mocks as [], and the importer takes it",
      );
    }
    ok(
      (kind === "topics" && sum.practice === 4 && sum.programming === 0 && sum.mocks === 0) ||
        (kind === "programming" && sum.programming === 1 && sum.practice === 0) ||
        (kind === "mocks" && sum.mockQuestions === 2 && sum.mocks === 1) ||
        (kind === "pack" && sum.practice === 4 && sum.programming === 1 && sum.mockQuestions === 2 && sum.mocks === 1),
      `questionSummary counts the ${kind} example by Practice tab`,
    );
  }

  const base = {
    subject: "S",
    topic: "T",
    type: "mcq",
    text: "Q?",
    options: ["a", "b", "c"],
    answer: "B",
  };
  const parse = (o: unknown) => parseQuestionFile(JSON.stringify(o));
  const file = (...qs: unknown[]) => ({ format: "orbit-questions", name: "P", questions: qs });
  const refusedWith = (o: unknown, word: string) => {
    const r = parse(o);
    return r.file === null && r.errors.some((e) => e.includes(word));
  };
  ok(parseQuestionFile("not json").file === null, "text that isn't JSON is refused");
  ok(parseQuestionFile("```json\n" + JSON.stringify(file(base)) + "\n```").file !== null, "``` fences are removed");
  ok(refusedWith({ ...file(base), format: "x" }, '"format"'), "a wrong format name is refused");
  ok(
    refusedWith({ format: "orbit-questions", name: "P" }, "nothing to import"),
    "a file with nothing in it is refused",
  );
  ok(refusedWith({ ...file(base), name: "" }, '"name"'), "a file without a name is refused");
  ok(refusedWith(file({ ...base, answer: "D" }), "ONE letter from A to C"), "mcq: answer out of range is refused");
  ok(parse(file({ ...base, answer: 1 })).file?.questions[0].type === "mcq", "mcq: a 0-based number is accepted too");
  ok(refusedWith(file({ ...base, answer: ["A"] }), "ONE letter"), "mcq: a list answer is refused");
  ok(refusedWith(file({ ...base, options: ["only one"] }), "options"), "mcq: fewer than two options is refused");
  ok(refusedWith(file({ ...base, type: "msq", answer: ["A", "A"] }), "twice"), "msq: the same option twice is refused");
  ok(refusedWith(file({ ...base, type: "msq", answer: "A" }), "list of letters"), "msq: a single answer is refused");
  ok(refusedWith(file({ ...base, type: "nat", answer: "3" }), "number"), "nat: a text answer is refused");
  ok(
    refusedWith(file({ ...base, type: "nat", answer: 3, tolerance: -1 }), "tolerance"),
    "nat: negative tolerance is refused",
  );
  ok(refusedWith(file({ ...base, type: "str", answer: 42 }), "answer"), "str: a number answer is refused");
  ok(
    refusedWith(file({ ...base, type: "str", answer: "x", match: "fuzzy" }), "match"),
    "str: an unknown match is refused",
  );
  ok(refusedWith(file({ ...base, type: "essay" }), "type"), "an unknown type is refused");
  ok(refusedWith(file({ ...base, difficulty: "impossible" }), "difficulty"), "an unknown difficulty is refused");
  ok(refusedWith(file({ ...base, marks: 0 }), "marks"), "zero marks is refused");
  ok(refusedWith(file({ ...base, topic: "" }), '"topic"'), "a missing topic is refused");
  ok(
    refusedWith(file({ ...base, id: "a" }, { ...base, id: "a", text: "other" }), "earlier question"),
    "the same id twice is refused",
  );
  const code = parse(file({ subject: "S", topic: "T", type: "code", text: "Write", starter: "x = 1\r\n" }));
  ok(
    code.file?.questions[0].type === "code" && (code.file.questions[0] as { starter: string }).starter === "x = 1\n",
    "code: starter code is kept (line endings tidied)",
  );
  const slash = parse(file({ ...base, text: "ok $\\frac{1}{2}$, broken $\frac{1}{2}$" }));
  ok(
    slash.file?.questions[0].stem === "ok $\\frac{1}{2}$, broken $\\frac{1}{2}$" &&
      slash.warnings.some((w) => w.includes("backslash")),
    "JSON-broken LaTeX backslashes are repaired, with a warning",
  );
  const dup = parse({
    ...file({ ...base, id: "a" }, { ...base, id: "b", text: " q?  " }),
    mocks: [{ name: "M", minutes: 10, sections: [{ name: "S", questions: ["b"] }] }],
  });
  ok(
    dup.file?.questions.length === 1 && dup.warnings.some((w) => w.includes("repeat")) && dup.file.mocks.length === 1,
    "a repeat inside the file is dropped (warning), and a mock using it still works",
  );
  const mock = (sections: unknown) => ({
    ...file({ ...base, id: "a" }, { ...base, id: "b", text: "Q2?" }),
    mocks: [{ name: "M", minutes: 30, sections }],
  });
  {
    const p = parse(mock([{ name: "S", questions: ["a", "zz"] }]));
    ok(
      p.file !== null &&
        p.file.bankRefs.length === 1 &&
        p.file.bankRefs[0].id === "zz" &&
        bankRefErrors(p.file, new Set(["zz"]))[0].includes("isn't in this file or in your question bank") &&
        bankRefErrors(p.file, new Set()).length === 0,
      "a mock question id not in the file is left for the bank to answer (bankRefs, bankRefErrors)",
    );
    const one = parse({ name: "Lone mock", minutes: 30, sections: [{ name: "S", questions: ["q_1"] }] });
    ok(
      one.file?.name === "Lone mock" &&
        one.file.mocks.length === 1 &&
        one.file.bankRefs[0]?.id === "q_1" &&
        one.warnings.some((w) => w.includes("one mock test on its own")),
      "one mock on its own (no questions / mocks keys) is read as a file holding just that mock",
    );
  }
  ok(
    refusedWith(
      mock([
        { name: "S", questions: ["a"] },
        { name: "T", questions: ["a"] },
      ]),
      "once per mock",
    ),
    "a question in two sections of one mock is refused",
  );
  {
    const one = (extra: object) => {
      const f = mock([{ name: "S", questions: ["a"] }]);
      return parse({ ...f, mocks: [{ ...f.mocks[0], ...extra }] }).file?.mocks[0].full_screen;
    };
    ok(
      one({}) === true && one({ full_screen: true }) === true && one({ full_screen: false }) === false,
      "a mock runs in full screen unless the file says false",
    );
  }
  ok(refusedWith(mock([]), "sections"), "a mock with no sections is refused");
  ok(
    refusedWith(mock([{ name: "S", minutes: 99, questions: ["a"] }]), "minutes"),
    "a section longer than the mock is refused",
  );
  ok(
    parse({ ...mock([{ name: "S", questions: ["a"] }]), mocks: [{ name: "M", minutes: 0, sections: [] }] }).file ===
      null,
    "a mock with 0 minutes is refused",
  );
  ok(
    parse(file({ ...base, pool: "mock", id: "a" })).warnings.some((w) => w.includes("no mock")),
    'a "mock" question no mock uses is a warning',
  );
  ok(
    questionHash(parse(file(base)).file!.questions[0]) === questionHash(parse(file({ ...base })).file!.questions[0]),
    "the content hash is stable",
  );

  // the import query, against the real schema
  const d = freshDb();
  const s3 = bunSql(d);
  type Imp = {
    ok: boolean;
    errors?: string[];
    warnings: string[];
    total?: number;
    practice?: number;
    programming?: number;
    mockQuestions?: number;
    existing?: number;
    mocks?: number;
  };
  const imp = (text: string, hash: string | null = null) =>
    transaction(s3, () =>
      (QUERIES["pack.import"] as unknown as QueryDef<unknown, unknown>).run(s3, {
        text,
        fileName: "f.json",
        fileHash: hash,
      }),
    ) as Imp;
  const n = (t: string) => (d.query(`SELECT count(*) AS n FROM ${t}`).get() as { n: number }).n;
  const counts = () =>
    transaction(s3, () =>
      (QUERIES["practice.counts"] as unknown as QueryDef<unknown, PracticeCounts>).run(s3, undefined),
    );

  const no = imp(JSON.stringify(file({ ...base, answer: "Z" })));
  ok(
    !no.ok && n("packs") === 0 && n("questions") === 0 && n("subjects") === 0,
    "pack.import: a refused file writes nothing",
  );
  ok(
    tabEmpty("topics", counts()) && tabEmpty("programming", counts()) && tabEmpty("mocks", counts()),
    "…and every Practice tab is still empty",
  );

  const topics = imp(JSON.stringify(exampleQuestions("topics")), "hash-1");
  ok(
    topics.ok && topics.total === 4 && topics.practice === 4 && n("packs") === 1 && n("questions") === 4,
    "pack.import: the topics example is saved as questions",
  );
  ok(
    n("question_mcq") === 1 && n("question_msq") === 1 && n("question_nat") === 1 && n("question_str") === 1,
    "…each in its own type table",
  );
  ok(
    n("subjects") === 2 && n("topics") === 4 && n("tags") === 1 && n("question_tags") === 1,
    "…with subjects, topics and tags created",
  );
  const mcqRow = d.query("SELECT options, correct FROM question_mcq").get() as { options: string; correct: number };
  ok(JSON.parse(mcqRow.options).length === 4 && mcqRow.correct === 0, "…and the mcq's answer letter became an index");
  ok(
    !tabEmpty("topics", counts()) && tabEmpty("programming", counts()),
    "…so only the Topics tab has something to show now",
  );

  const again = imp(JSON.stringify(exampleQuestions("topics")), "hash-1");
  ok(
    !again.ok && again.errors![0].includes("already imported") && n("questions") === 4,
    "pack.import: the same file twice is refused",
  );
  const other = imp(JSON.stringify({ ...exampleQuestions("topics"), name: "Renamed" }), "hash-2");
  ok(
    other.ok && other.total === 0 && other.existing === 4 && n("questions") === 4 && n("packs") === 2,
    "pack.import: questions already in the bank are not added twice",
  );
  ok(n("subjects") === 2 && n("topics") === 4, "…and subjects and topics are matched by name, not copied");

  const prog = imp(JSON.stringify(exampleQuestions("programming")), "hash-3");
  ok(
    prog.ok && prog.programming === 1 && n("question_code") === 1 && !tabEmpty("programming", counts()),
    "pack.import: code questions fill the Programming tab",
  );

  const mocks = imp(JSON.stringify(exampleQuestions("mocks")), "hash-4");
  ok(
    mocks.ok &&
      mocks.mocks === 1 &&
      mocks.mockQuestions === 2 &&
      n("mocks") === 1 &&
      n("mock_sections") === 2 &&
      n("mock_items") === 2,
    "pack.import: a mock, its sections and its questions are saved",
  );
  const sec = d.query("SELECT name, minutes FROM mock_sections ORDER BY position").all() as {
    name: string;
    minutes: number | null;
  }[];
  ok(sec[0].minutes === null && sec[1].minutes === 10, "…section time limits are kept (none = shares the clock)");
  ok(
    (d.query("SELECT count(*) AS n FROM questions WHERE pool = 'mock'").get() as { n: number }).n === 2 &&
      !tabEmpty("mocks", counts()),
    "…and the mock's questions are mock-only, so topic practice never shows them",
  );
  {
    // a mock using questions already in the bank, by their id
    const inBank = (
      d.query("SELECT id FROM questions WHERE pool = 'mock' ORDER BY id LIMIT 2").all() as { id: string }[]
    ).map((r) => r.id);
    const lone = (ids: string[]) =>
      JSON.stringify({ name: "From the bank", minutes: 20, sections: [{ name: "S", questions: ids }] });
    const before = n("mocks");
    const nope = imp(lone([inBank[0], "q_nowhere"]));
    ok(
      !nope.ok && nope.errors![0].includes("q_nowhere") && n("mocks") === before && n("packs") === 4,
      "pack.import: a mock id found neither in the file nor in the bank refuses the file and writes nothing",
    );
    const yes = imp(lone(inBank));
    const items = (
      d
        .query(
          "SELECT i.question_id AS id FROM mock_items i JOIN mock_sections s ON s.id = i.section_id JOIN mocks m ON m.id = s.mock_id WHERE m.name = 'From the bank' ORDER BY i.position",
        )
        .all() as { id: string }[]
    ).map((r) => r.id);
    ok(
      yes.ok && yes.mocks === 1 && yes.total === 0 && items.join() === inBank.join(),
      "pack.import: a lone mock uses the bank's questions by id, in order, adding none",
    );
    const missing = transaction(s3, () =>
      (QUERIES["pack.missing"] as unknown as QueryDef<unknown, string[]>).run(s3, { ids: [inBank[0], "q_x", "q_x"] }),
    );
    ok(missing.join() === "q_x", "pack.missing: lists the ids the bank doesn't have, once each");
  }
  ok(d.query("PRAGMA foreign_key_check").all().length === 0, "pack.import: no foreign key violations");
}
