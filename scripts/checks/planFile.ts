// check.ts section: planFile. Run: bun run check
import { parseDayPatch } from "@/lib/planEdit";
import { examplePatch, patchPrompt } from "@/lib/prompts/patchPrompt";
import { parsePlanFile, planSummary } from "@/lib/planFile";
import { examplePlan, planPrompt } from "@/lib/prompts/planPrompt";
import { QUERIES, type QueryDef } from "@/lib/db/queries";
import { transaction } from "@/lib/db/sql";
import { ok, freshDb, bunSql } from "@/scripts/checks/helpers";

console.log("plan file (lib/planFile.ts) and its AI prompt");
{
  const base = { format: "orbit-plan", version: 1, name: "P" };
  const parse = (o: unknown) => parsePlanFile(typeof o === "string" ? o : JSON.stringify(o));
  const r1 = parse({
    ...base,
    milestones: [{ name: "Exam", date: "2026-12-10" }],
    days: [
      { from: "2026-11-30", to: "2026-12-06", weekdays: ["mon", "wed"], title: "Range", tasks: ["a", "b"] },
      { date: "2026-12-02", title: "Single wins", kind: "exam", hours: 1.5 },
      { from: "2026-12-07", to: "2026-12-08", title: "Later range", questions: ["q1", "q1", "q2"] },
    ],
  });
  ok(r1.plan !== null && r1.errors.length === 0, "a valid file is accepted");
  ok(
    JSON.stringify(r1.plan!.days.map((d) => d.date)) === '["2026-11-30","2026-12-02","2026-12-07","2026-12-08"]',
    "ranges expand, weekdays filter (mon, wed)",
  );
  ok(
    r1.plan!.days[1].title === "Single wins" && r1.plan!.days[1].kind === "exam" && r1.plan!.days[1].hours === 1.5,
    "a single date beats a range",
  );
  ok(
    r1.plan!.starts_on === "2026-11-30" && r1.plan!.ends_on === "2026-12-08",
    "plan dates default to the first / last day",
  );
  ok(
    JSON.stringify(r1.plan!.days[2].questions) === '["q1","q2"]' && r1.plan!.days[0].kind === "study",
    "question ids deduped; kind defaults to study",
  );
  const bad = parse({
    format: "something-else",
    days: [
      { date: "2026-02-30", title: "x" },
      { from: "2026-12-05", to: "2026-12-01", title: "x" },
      { date: "2026-12-01" },
      { date: "2026-12-01", title: "x", kind: "party" },
      { from: "2026-12-01", to: "2026-12-03", weekdays: ["funday"], title: "x" },
      { date: "2026-12-04", weekdays: ["mon"], title: "x" },
      { date: "2026-12-05", title: "x", tasks: Array(21).fill("t") },
    ],
  });
  ok(bad.plan === null && bad.errors.length >= 8, "a bad file is refused with one message per problem");
  ok(
    bad.errors.some((e) => e.includes('"name"')) &&
      bad.errors.some((e) => e.includes("2026-02-30")) &&
      bad.errors.some((e) => e.includes("party")),
    "…messages name the field and the value",
  );
  ok(
    parse({
      ...base,
      days: [
        { date: "2026-12-01", title: "a" },
        { date: "2026-12-01", title: "b" },
      ],
    }).errors.some((e) => e.includes("already planned")),
    "the same single date twice is refused",
  );
  ok(
    parse({ ...base, starts_on: "2026-12-05", days: [{ date: "2026-12-01", title: "a" }] }).errors.some((e) =>
      e.includes("outside"),
    ),
    "a day outside starts_on…ends_on is refused",
  );
  ok(
    parse("not json").errors[0].includes("valid JSON") && parse("[1]").plan === null,
    "not JSON / not an object is refused",
  );
  const fenced = "```json\n" + JSON.stringify({ ...base, days: [{ date: "2026-12-01", title: "a" }] }) + "\n```";
  ok(parse(fenced).plan !== null, "a file wrapped in ``` fences (as AI chats reply) is read");
  // JSON source with a correct "\\frac" and a broken single "\frac" (JSON reads that as a form feed + "rac")
  const broken = parse(
    '{"format":"orbit-plan","name":"P","days":[{"date":"2026-12-01","title":"ok $\\\\frac{a}{b}$, broken $\\frac{1}{2}$"}]}',
  );
  ok(
    broken.plan!.days[0].title === "ok $\\frac{a}{b}$, broken $\\frac{1}{2}$" &&
      broken.warnings.some((w) => w.includes("backslash")),
    "JSON-broken LaTeX backslashes are repaired, with a warning",
  );
  ok(
    parse({ name: "P", days: [{ date: "2026-12-01", title: "a" }] }).warnings.some((w) => w.includes('"format"')),
    "a missing format is only a warning",
  );
  const today = "2026-11-20";
  const ex = parsePlanFile(JSON.stringify(examplePlan(today)));
  ok(
    ex.plan !== null && ex.errors.length === 0 && ex.warnings.length === 0,
    "the prompt's example passes the importer with no warnings",
  );
  const prompt = planPrompt(today);
  ok(
    prompt.includes(JSON.stringify(examplePlan(today), null, 2)) && prompt.includes(today),
    "the prompt contains the example and today's date",
  );
  ok(!/\b(GATE|JEE|NEET|UPSC|SAT|GRE)\b/.test(prompt), "the prompt names no particular exam");
  const s = planSummary(ex.plan!);
  ok(s.milestones === 2 && s.days > 15 && s.tasks > 30, "planSummary counts days, tasks and milestones");

  // the import query, against the real schema
  const d = freshDb();
  const s2 = bunSql(d);
  const imp = (text: string) =>
    transaction(s2, () => (QUERIES["plan.import"] as unknown as QueryDef<unknown, unknown>).run(s2, { text })) as {
      ok: boolean;
      days?: number;
      tasks?: number;
      links?: number;
      warnings: string[];
      errors?: string[];
    };
  const before = (d.query("SELECT count(*) AS n FROM plans").get() as { n: number }).n;
  const no = imp(JSON.stringify({ format: "orbit-plan", days: [] }));
  ok(
    !no.ok && (d.query("SELECT count(*) AS n FROM plans").get() as { n: number }).n === before,
    "plan.import: a refused file writes nothing",
  );
  const yes = imp(JSON.stringify(examplePlan(today)));
  const rows = (t: string) => (d.query(`SELECT count(*) AS n FROM ${t}`).get() as { n: number }).n;
  ok(
    yes.ok &&
      rows("plans") === 1 &&
      rows("plan_days") === yes.days &&
      rows("plan_tasks") === yes.tasks &&
      rows("milestones") === 2,
    "plan.import: plan, days, tasks and milestones are written",
  );
  ok(rows("plan_day_progress") === yes.days, "…and day progress is set up by the triggers");
  const linked = imp(
    JSON.stringify({
      format: "orbit-plan",
      name: "Links",
      days: [{ date: "2026-12-01", title: "x", questions: ["nope"] }],
    }),
  );
  ok(
    linked.ok && linked.links === 0 && linked.warnings.some((w) => w.includes("aren't in your question bank")),
    "plan.import: unknown question ids are skipped with a warning",
  );
  ok(
    (d.query("SELECT count(*) AS n FROM plans WHERE is_active = 1").get() as { n: number }).n === 1,
    "plan.import: the new plan is the only active one",
  );
  ok(d.query("PRAGMA foreign_key_check").all().length === 0, "plan.import: no foreign key violations");
}

console.log("plan.applyPatch (Edit plan: update days from JSON)");
{
  const d = freshDb();
  const s = bunSql(d);
  const q = (name: string, p: unknown) =>
    transaction(s, () => (QUERIES[name as "plan.import"] as unknown as QueryDef<unknown, unknown>).run(s, p)) as {
      ok?: boolean;
      errors?: string[];
      warnings?: string[];
      updated?: number;
      added?: number;
    };
  const base = { format: "orbit-plan", name: "Keep me", milestones: [{ name: "Exam", date: "2026-12-30" }] };
  q("plan.import", {
    text: JSON.stringify({
      ...base,
      starts_on: "2026-11-20",
      ends_on: "2026-12-31",
      days: [
        { date: "2026-12-01", title: "One", tasks: ["a", "b"] },
        { date: "2026-12-02", title: "Two", tasks: ["c"] },
        { date: "2026-12-03", title: "Three", tasks: ["d"] },
      ],
    }),
  });
  d.exec("INSERT INTO plan_task_ticks (task_id, done_at) SELECT id, 1 FROM plan_tasks WHERE body = 'a'");
  const clock = { today: "2026-11-25", hour: 10 };
  const patch = JSON.stringify({
    name: "Ignored",
    days: [
      { date: "2026-12-01", title: "One v2", tasks: ["a", "new"] },
      { date: "2026-12-05", title: "Added", tasks: ["x"] },
      { date: "2026-11-20", title: "Locked", tasks: ["z"] },
      { date: "2027-02-01", title: "Outside", tasks: ["z"] },
    ],
  });
  const r = q("plan.applyPatch", { ...clock, text: patch });
  const body = (date: string) =>
    (
      d
        .query(
          "SELECT t.body FROM plan_tasks t JOIN plan_days p ON p.id = t.day_id WHERE p.on_date = ? ORDER BY t.position",
        )
        .all(date) as { body: string }[]
    ).map((x) => x.body);
  ok(r.ok && r.updated === 1 && r.added === 1, "only the listed open dates change (1 updated, 1 added)");
  ok(
    r.warnings?.some((w) => w.includes("outside")) && r.warnings?.some((w) => w.includes("locked")),
    "dates outside the plan and locked dates are skipped with warnings",
  );
  ok(body("2026-12-01").join() === "a,new", "the updated day has the file's tasks");
  ok(body("2026-12-02").join() === "c" && body("2026-12-03").join() === "d", "days not in the file are untouched");
  ok(
    (d.query("SELECT count(*) AS n FROM plan_task_ticks").get() as { n: number }).n === 1,
    "a task whose text stays keeps its tick",
  );
  ok(
    (d.query("SELECT name FROM plans").get() as { name: string }).name === "Keep me" &&
      (d.query("SELECT count(*) AS n FROM milestones").get() as { n: number }).n === 1,
    "the plan's name and milestones are untouched",
  );
  const bad = q("plan.applyPatch", { ...clock, text: '{"days":[{"date":"2026-12-01"}]}' });
  ok(bad.ok === false && !!bad.errors?.length, "a bad patch is refused and writes nothing");
}

console.log("patch prompt (lib/prompts/patchPrompt.ts)");
{
  const today = "2026-11-20";
  const ex = parseDayPatch(JSON.stringify(examplePatch(today)));
  ok(ex.plan !== null && ex.errors.length === 0 && ex.warnings.length === 0, "the patch prompt's example passes");
  const p = patchPrompt(today, {
    plan: { name: "My plan", description: null, starts_on: "2026-11-01", ends_on: "2027-02-01" },
    days: [
      {
        date: "2026-11-22",
        title: "Day",
        kind: "study",
        hours: 2,
        note: null,
        tasks: ["Do a thing"],
        bonus: [{ from: "2026-11-18", task: "Old task" }],
      },
    ],
    stuck: [{ on: "2026-11-19", from: "2026-11-17", question: "q_stuck" }],
  });
  ok(
    p.includes(JSON.stringify(examplePatch(today), null, 2)) && p.includes("Do a thing") && p.includes("My plan"),
    "the patch prompt has the example, the open days and the plan name",
  );
  ok(
    p.includes("Old task") && p.includes("q_stuck") && p.includes('"bonus"'),
    "the patch prompt shows each day's bonus work and the bonus stuck on past days, and explains moving it",
  );
  ok(!/\b(GATE|JEE|NEET|UPSC|SAT|GRE)\b/.test(p), "the patch prompt names no particular exam");
  const bare = parseDayPatch('{"days":[{"date":"2026-12-01","title":"x"}]}');
  ok(bare.plan !== null && !bare.warnings.length, 'a patch needs no "name", milestones or "format" noise');
}

console.log("plan file: bonus work and carried_before");
{
  const file = (days: unknown[], extra: object = {}) =>
    parsePlanFile({ format: "orbit-plan", name: "P", milestones: [{ name: "E", date: "2026-12-30" }], days, ...extra });
  const ok1 = file(
    [
      { date: "2026-12-01", title: "One", tasks: ["a"], questions: ["q_1"] },
      {
        date: "2026-12-02",
        title: "Two",
        bonus: [
          { from: "2026-12-01", task: "a" },
          { from: "2026-12-01", question: "q_1" },
          { from: "2026-12-01", task: "a" },
        ],
      },
    ],
    { carried_before: "2026-12-02" },
  );
  ok(
    ok1.plan !== null &&
      ok1.plan.days[1].bonus.length === 2 &&
      ok1.plan.days[1].hasBonus === true &&
      ok1.plan.days[0].hasBonus === false &&
      ok1.plan.carried_before === "2026-12-02",
    "bonus entries are read (repeats once) and carried_before is kept",
  );
  ok(
    !file([{ date: "2026-12-02", title: "x", bonus: [{ from: "2026-12-02", task: "a" }] }]).plan,
    'a bonus entry whose "from" isn\'t an earlier day is refused',
  );
  ok(
    !file([{ date: "2026-12-02", title: "x", bonus: [{ from: "2026-12-01", task: "a", question: "q" }] }]).plan &&
      !file([{ date: "2026-12-02", title: "x", bonus: [{ from: "2026-12-01" }] }]).plan,
    'a bonus entry needs exactly one of "task" / "question"',
  );
  ok(!file([{ from: "2026-12-01", to: "2026-12-03", title: "x", bonus: [] }]).plan, '"bonus" on a range is refused');
  ok(!file([{ date: "2026-12-01", title: "x" }], { carried_before: "soon" }).plan, "a bad carried_before is refused");
}
