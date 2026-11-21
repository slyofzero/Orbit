// check.ts section: planner. Run: bun run check
import {
  carouselDays,
  cardLabel,
  dayCount,
  dayState,
  emptyDayNote,
  groupByMonth,
  missedDays,
  stripLabel,
  stripSegments,
  windowDays,
  type PlannerDay,
} from "@/lib/planner";
import { addDays, weekday } from "@/lib/dates";
import { QUERIES, type QueryDef } from "@/lib/db/queries";
import { checkDay, idsFromText } from "@/lib/planEdit";
import { parsePlanFile, planToFile } from "@/lib/planFile";
import {
  PROMPT_LIMIT,
  isTooLong,
  linkFiles,
  linkPrompt,
  parseLinks,
  readAnswer,
  type LinkInput,
} from "@/lib/planLinks";
import { examplePlan } from "@/lib/prompts/planPrompt";
import { transaction } from "@/lib/db/sql";
import { ok, freshDb, bunSql, seed } from "@/scripts/checks/helpers";

console.log("planner rules (lib/planner.ts)");

{
  const today = "2026-11-20"; // a Friday
  ok(
    windowDays(today, 0).join() === "2026-11-20,2026-11-21,2026-11-22" &&
      windowDays(today, -2).join() === "2026-11-18,2026-11-19,2026-11-20",
    "3-day window shifts with the offset",
  );
  const car = carouselDays(today, 0);
  ok(
    car.length === 5 &&
      car.find((c) => c.pos === 0)?.date === today &&
      car.find((c) => c.pos === -1)?.date === "2026-11-19" &&
      car.find((c) => c.pos === 1)?.date === "2026-11-21" &&
      carouselDays(today, 3).find((c) => c.pos === 0)?.date === "2026-11-23",
    "carousel: today in the middle, a day either side, the centre moves with the offset",
  );
  ok(
    cardLabel(today, today) === "Today" &&
      cardLabel("2026-11-21", today) === "Tomorrow" &&
      cardLabel("2026-11-19", today) === "Yesterday" &&
      cardLabel("2026-11-23", today) === "Monday",
    "card labels",
  );
  const day = (
    on_date: string,
    status: PlannerDay["status"],
    done = 0,
    total = 4,
    kind: PlannerDay["kind"] = "study",
  ) =>
    ({
      on_date,
      title: null,
      kind,
      hours: null,
      status,
      tasks_total: total,
      tasks_done: done,
      questions_total: 0,
      questions_done: 0,
    }) satisfies PlannerDay;
  ok(
    dayState(day("2026-11-18", "done", 4), today) === "won" &&
      dayState(day("2026-11-18", "partial", 2), today) === "missed" &&
      dayState(day("2026-11-18", "incomplete", 0, 4, "exam"), today) === "pending" &&
      dayState(day(today, "partial", 1), today) === "partial" &&
      dayState(day("2026-11-25", "incomplete"), today) === "pending" &&
      dayState(day("2026-11-25", null, 0, 0), today) === "rest",
    "day states: won, missed (past, not exam), partial, pending, rest",
  );
  ok(
    dayCount(day(today, "partial", 2)) === "2/4" &&
      dayCount(day(today, "done", 4)) === "✓" &&
      dayCount(day(today, null, 0, 0)) === "",
    "row counts",
  );
  const days = [
    day("2026-10-30", "done", 4),
    day("2026-10-31", "incomplete"),
    day("2026-11-02", "partial", 1),
    day("2026-11-20", "partial", 3),
    day("2026-12-01", "incomplete", 0, 4, "exam"),
  ];
  ok(
    missedDays(days, today)
      .map((d) => d.on_date)
      .join() === "2026-10-31,2026-11-02",
    "missed: past days left unfinished",
  );
  const months = groupByMonth(days, today);
  ok(
    months.map((m) => m.label).join() === "October 2026,November 2026,December 2026" &&
      months[1].current &&
      !months[0].current &&
      months[1].from === "2026-11-02" &&
      months[1].to === "2026-11-20" &&
      months[1].weeks.map((w) => w.label).join() === "Week of 2 Nov,Week of 16 Nov" &&
      months[0].weeks.length === 1 &&
      months[0].weeks[0].start === "2026-10-26",
    "full plan: months, the current one open, weeks starting Monday",
  );
  ok(groupByMonth(days, "2026-01-01")[0].current, "full plan: before the plan starts, the first month is open");
  const seg = stripSegments(days, today);
  ok(
    seg.length === 4 &&
      seg.map((s) => s.state).join() === "won,missed,missed,partial" &&
      seg[3].part === 0.75 &&
      seg[0].weight === 4 &&
      stripLabel(seg) === "1 of 4 days done, 2 missed",
    "month strip: exam days left out, states, part done, label",
  );
  const span = { starts_on: "2026-11-02", ends_on: "2026-12-01" };
  ok(
    emptyDayNote("2026-11-01", span) === "Your plan starts on Mon, 2 Nov 2026." &&
      emptyDayNote("2026-12-02", span) === "The plan has ended." &&
      emptyDayNote("2026-11-22", span) === "",
    "empty day note",
  );

  // the planner's queries over the sample plan
  const d = freshDb();
  const s = bunSql(d);
  const run = <R>(name: keyof typeof QUERIES, params?: unknown) =>
    transaction(s, () => (QUERIES[name] as unknown as QueryDef<unknown, R>).run(s, params));
  ok(run("planner.days") === null, "planner.days: null without a plan");
  run("dev.samplePlan", { today });
  const pd = run<{ plan: { name: string }; days: PlannerDay[] }>("planner.days")!;
  ok(
    pd.plan.name === "Sample plan" &&
      pd.days.length > 70 &&
      pd.days.every((x, i) => i === 0 || pd.days[i - 1].on_date < x.on_date) &&
      pd.days.find((x) => x.on_date === today)?.tasks_done === 1,
    "planner.days: every day in order, with progress counts",
  );
  ok(missedDays(pd.days, today).length > 0, "planner.days: the sample plan has missed days");
  const todayDay = run<{ day: { id: number } }>("dashboard.day", { date: today, today }).day.id;
  const statusOf = () => run<{ days: PlannerDay[] }>("planner.days").days.find((x) => x.on_date === today)?.status;
  run("plan.tickDay", { dayId: todayDay, done: true });
  run("plan.tickDay", { dayId: todayDay, done: true });
  ok(statusOf() === "done", "plan.tickDay: ticks every task (twice is harmless)");
  run("plan.tickDay", { dayId: todayDay, done: false });
  ok(statusOf() === "incomplete", "plan.tickDay: unticks every task");

  // Manage plan's task table: pages of plan days
  type Tasks = {
    rows: { id: number; on_date: string; body: string; done: boolean; kind: string }[];
    page: number;
    pages: number;
    matched: { days: number; tasks: number };
    counts: { all: number; upcoming: number; past: number; done: number; days: number };
  };
  const tasks = (p: Record<string, unknown>) =>
    run<Tasks>("planner.tasks", { search: "", when: "all", kind: null, today, page: 0, days: 5, ...p });
  const dates = (t: Tasks) => [...new Set(t.rows.map((r) => r.on_date))];
  const all = tasks({ days: 2000 });
  ok(
    all.matched.tasks === all.counts.all &&
      all.rows.length === all.counts.all &&
      all.matched.days === all.counts.days &&
      all.counts.upcoming + all.counts.past === all.counts.all &&
      all.counts.days > 70 &&
      all.rows.every((r, i) => i === 0 || all.rows[i - 1].on_date <= r.on_date),
    "planner.tasks: every task, in day order, with counts",
  );
  const up = tasks({ when: "upcoming" });
  ok(
    dates(up).length === 5 &&
      dates(up)[0] === dates(all).find((d) => d >= today) &&
      up.rows.length === all.rows.filter((r) => dates(up).includes(r.on_date)).length,
    "planner.tasks: From today opens on today, 5 days with all their tasks",
  );
  const past = tasks({ when: "past", days: 2000 });
  ok(
    past.matched.tasks === all.counts.past &&
      past.rows.every((r) => r.on_date < today) &&
      past.rows.every((r, i) => i === 0 || past.rows[i - 1].on_date >= r.on_date),
    "planner.tasks: Past is before today, newest first",
  );
  const here = tasks({ page: null });
  ok(
    here.page === Math.floor(dates(all).filter((d) => d < today).length / 5) && dates(here).some((d) => d >= today),
    "planner.tasks: All opens on the page holding today",
  );
  const p2 = tasks({ page: 1 });
  ok(p2.page === 1 && dates(p2).join() === dates(all).slice(5, 10).join(), "planner.tasks: page 2 is days 6 to 10");
  ok(
    tasks({ page: 9999 }).page === Math.ceil(all.counts.days / 5) - 1,
    "planner.tasks: a page past the end is the last",
  );
  ok(all.counts.done === all.rows.filter((r) => r.done).length, "planner.tasks: done flags match the count");
  const word = all.rows[0].body.split(/\s+/)[0];
  const found = tasks({ search: word.toUpperCase(), days: 2000 });
  ok(found.matched.tasks > 0 && found.matched.tasks <= all.matched.tasks, "planner.tasks: search ignores case");
  const pastDay = past.rows[0].on_date;
  const onDay = tasks({ when: "upcoming", range: { from: pastDay, to: pastDay } });
  ok(
    onDay.rows.length > 0 &&
      onDay.rows.every((r) => r.on_date === pastDay) &&
      onDay.rows.length === all.rows.filter((r) => r.on_date === pastDay).length,
    "planner.tasks: a one-day range shows that day's tasks only, whatever the tab",
  );
  const wk = { from: addDays(today, -3), to: addDays(today, 3) };
  const inWeek = tasks({ when: "past", range: wk, days: 2000 });
  ok(
    inWeek.rows.length === all.rows.filter((r) => r.on_date >= wk.from && r.on_date <= wk.to).length &&
      inWeek.rows.some((r) => r.on_date >= today),
    "planner.tasks: a week range shows every task in it, whatever the tab",
  );
  const sat = tasks({ range: { from: "2000-01-01", to: "2999-12-31", weekday: 5 }, days: 2000 });
  ok(
    sat.rows.length > 0 &&
      sat.rows.every((r) => weekday(r.on_date) === 5) &&
      sat.rows.length === all.rows.filter((r) => weekday(r.on_date) === 5).length,
    "planner.tasks: a weekday range shows every Saturday's tasks and nothing else",
  );
  const kind = all.rows[0].kind;
  ok(
    tasks({ kind, days: 2000 }).rows.every((r) => r.kind === kind),
    "planner.tasks: kind filter",
  );
}

console.log("plan actions (lib/planLinks.ts, lib/planEdit.ts, lib/db/queries/planEdit.ts)");
{
  // Export plan: what planToFile writes, parsePlanFile reads back unchanged
  const ex = parsePlanFile(JSON.stringify(examplePlan("2026-11-20"))).plan!;
  const back = parsePlanFile(JSON.stringify(planToFile(ex)));
  ok(
    back.plan !== null && JSON.stringify(back.plan) === JSON.stringify(ex),
    "planToFile: an exported plan imports back exactly the same",
  );

  // the AI reply
  ok(
    JSON.stringify(readAnswer('```json\n{"days": []}\n```').value) === '{"days":[]}',
    "readAnswer: strips a code fence",
  );
  const cut = readAnswer('{"days": [{"date": "2026-11-21", "questions": ["q_1"]}');
  ok(
    cut.errors.length === 0 && cut.warnings.length === 1 && Array.isArray((cut.value as { days: unknown[] }).days),
    "readAnswer: a reply cut off early gets its closing brackets back, with a warning",
  );
  ok(readAnswer("not json at all").errors.length === 1, "readAnswer: plain text is refused");
  const rules = {
    dates: new Set(["2026-11-19", "2026-11-21", "2026-11-22"]),
    practice: new Set(["q_1", "q_2", "q_3"]),
    mock: new Set(["m_1"]),
    locked: new Set(["2026-11-19"]),
  };
  const r = parseLinks(
    {
      days: [
        { date: "2026-11-21", questions: ["q_1", "q_1", "nope", "m_1", "q_2"] },
        { date: "2026-11-19", questions: ["q_3"] },
        { date: "2030-01-01", questions: ["q_3"] },
        { date: "2026-11-22", practice: ["q_3"] },
      ],
    },
    rules,
  );
  ok(
    JSON.stringify(r.links) ===
      '[{"date":"2026-11-21","questions":["q_1","q_2"]},{"date":"2026-11-22","questions":["q_3"]}]' &&
      r.days === 2 &&
      r.questions === 3,
    "parseLinks: keeps known ids once, reads v1's \"practice\", in the reply's order",
  );
  ok(
    r.warnings.length === 4 &&
      r.warnings.some((w) => w.includes("locked")) &&
      r.warnings.some((w) => w.includes("nope")) &&
      r.warnings.some((w) => w.includes("mock test")) &&
      r.warnings.some((w) => w.includes("2030-01-01")),
    "parseLinks: reports a locked day, an unknown id, a mock question and a date outside the plan",
  );
  ok(
    parseLinks({ days: [{ date: "2026-11-19", questions: ["q_1"] }] }, rules).links === null &&
      parseLinks({ nothing: 1 }, rules).errors.length === 1,
    "parseLinks: nothing usable (only a locked day, or the wrong shape) is refused",
  );
  const input: LinkInput = {
    plan: { name: "P", description: "my words" },
    days: [
      { date: "2026-11-19", kind: "study", hours: 2, title: "Old day", tasks: ["x"] },
      { date: "2026-11-21", kind: "study", hours: 2, title: "Graphs", tasks: ["Read about **trees**"] },
    ],
    topics: [{ id: "tp_1", name: "Graphs", subject: "Maths", rating: "no_idea" }],
    questions: [
      { id: "q_1", topic_id: "tp_1", type: "mcq", marks: 1, difficulty: "easy", tags: [], text: "What is a tree?" },
    ],
    current: [{ date: "2026-11-21", questions: ["q_1"] }],
    locked: ["2026-11-19"],
  };
  const prompt = linkPrompt(input);
  ok(
    prompt.includes("q_1 | tp_1 | mcq | 1m | easy") &&
      prompt.includes("Graphs") &&
      !prompt.includes("Old day") &&
      prompt.includes("I ALREADY HAVE LINKS") &&
      prompt.includes("my words") &&
      prompt.includes("no idea"),
    "linkPrompt: open days, topics with feelings, questions and current links; locked days left out",
  );
  ok(
    !/\b(GATE|JEE|NEET|UPSC|SAT|GRE)\b/.test(prompt + linkFiles(input).prompt),
    "link prompts name no particular exam",
  );
  const files = linkFiles(input);
  ok(
    files.bank.questionCount === 1 && files.plan.days.length === 1 && files.prompt.includes("question-bank.json"),
    "linkFiles: plan.json holds the open days, question-bank.json every question",
  );
  ok(isTooLong("x".repeat(PROMPT_LIMIT + 1)) && !isTooLong("x"), "isTooLong: past PROMPT_LIMIT");

  // the day editor's rules
  const form = { title: " Day ", kind: "study" as const, hours: "", note: "", tasks: [], questions: [] };
  ok(checkDay({ ...form, title: "  " }).day === null, "checkDay: a day needs a title");
  ok(checkDay({ ...form, hours: "25" }).day === null, "checkDay: hours from 0 to 24");
  const c = checkDay({
    ...form,
    hours: "1.5",
    tasks: [
      { id: 1, body: " a " },
      { id: null, body: "  " },
    ],
    questions: ["q_1", "q_1"],
  });
  ok(
    c.day?.title === "Day" && c.day.hours === 1.5 && c.day.tasks.length === 1 && c.day.questions.length === 1,
    "checkDay: trims, drops blank task rows and repeated questions",
  );
  ok(idsFromText('["q_1", "q_2"]\nq_3, q_1').join() === "q_1,q_2,q_3", "idsFromText: any list of ids, each once");

  // the queries, against the real schema
  const d = freshDb();
  const s = bunSql(d);
  const run = <R>(name: keyof typeof QUERIES, params?: unknown) =>
    transaction(s, () => (QUERIES[name] as unknown as QueryDef<unknown, R>).run(s, params));
  const n = (q: string, p: (string | number)[] = []) => (d.query(q).get(...p) as { n: number }).n;
  const today = "2026-11-20";
  seed(d, 6);
  d.exec("UPDATE questions SET pool = 'mock' WHERE id = 'q_5'");
  run("dev.samplePlan", { today });
  const days = d.query("SELECT id, on_date FROM plan_days ORDER BY on_date").all() as { id: number; on_date: string }[];
  const past = days.find((x) => x.on_date < today)!;
  const future = days.filter((x) => x.on_date > today);
  const clock = { today, hour: 8 }; // today still open
  d.query("INSERT INTO plan_day_questions (day_id, question_id, position) VALUES (?, 'q_0', 1)").run(past.id);

  const exp = run<{ file: unknown; days: number; links: number }>("plan.export");
  const again = parsePlanFile(JSON.stringify(exp.file));
  ok(
    again.plan !== null && again.plan.days.length === days.length && exp.links === 1,
    "plan.export: the active plan as a file that parses, links included",
  );

  const li = run<{ input: LinkInput; open: number }>("plan.linkInput", clock);
  ok(
    li.input.questions.length === 5 &&
      li.input.locked.every((x) => x < today) &&
      li.open === days.filter((x) => x.on_date >= today).length,
    "plan.linkInput: practice questions only; past days locked, today open before the lock hour",
  );
  const reply = JSON.stringify({
    days: [
      { date: future[0].on_date, questions: ["q_1", "q_2"] },
      { date: past.on_date, questions: ["q_3"] },
      { date: future[1].on_date, questions: ["q_5", "q_9"] },
    ],
  });
  const chk = run<{ errors: string[]; days: number }>("plan.checkLinks", { ...clock, text: reply });
  ok(chk.errors.length === 0 && chk.days === 1, "plan.checkLinks: checks a reply without saving");
  ok(n("SELECT count(*) AS n FROM plan_day_questions") === 1, "plan.checkLinks writes nothing");
  const ap = run<{ ok: boolean; days: number }>("plan.applyLinks", { ...clock, text: reply });
  ok(
    ap.ok &&
      n("SELECT count(*) AS n FROM plan_day_questions WHERE day_id = ?", [future[0].id]) === 2 &&
      n("SELECT count(*) AS n FROM plan_day_questions WHERE day_id = ?", [past.id]) === 1 &&
      n("SELECT count(*) AS n FROM plan_day_questions WHERE question_id = 'q_3'") === 0,
    "plan.applyLinks: links the open day; the past day keeps its own link and gets nothing new",
  );
  const ap2 = run<{ ok: boolean; cleared: number }>("plan.applyLinks", {
    ...clock,
    text: JSON.stringify({ days: [{ date: future[1].on_date, questions: ["q_4"] }] }),
  });
  ok(
    ap2.ok &&
      ap2.cleared === 1 &&
      n("SELECT count(*) AS n FROM plan_day_questions WHERE day_id = ?", [future[0].id]) === 0,
    "plan.applyLinks: the reply replaces the open days' links",
  );
  ok(
    !run<{ ok: boolean }>("plan.applyLinks", { ...clock, text: "nope" }).ok &&
      n("SELECT count(*) AS n FROM plan_day_questions") === 2,
    "plan.applyLinks: a bad reply changes nothing",
  );
  ok(
    n("SELECT questions_total AS n FROM plan_day_progress WHERE day_id = ?", [future[1].id]) === 1,
    "plan.applyLinks: the day's progress counts follow",
  );
  const un = run<{ days: number; kept: number }>("plan.unlinkAll", clock);
  ok(
    un.days === 1 && un.kept === 1 && n("SELECT count(*) AS n FROM plan_day_questions") === 1,
    "plan.unlinkAll: unlinks open days, locked days keep theirs",
  );

  // the day editor
  const day = future[0].id;
  const ed = run<{ tasks: { id: number; body: string }[] }>("plan.editDay", { dayId: day });
  d.exec("DELETE FROM plan_task_ticks");
  d.query("INSERT INTO plan_task_ticks (task_id, done_at) VALUES (?, 1)").run(ed.tasks[0].id);
  const save = run<{ ok: boolean; tasks: number; questions: number; dropped: number }>("plan.saveDay", {
    ...clock,
    dayId: day,
    form: {
      title: "Edited",
      kind: "light",
      hours: "2",
      note: "n",
      tasks: [
        { id: null, body: "brand new" },
        { id: ed.tasks[0].id, body: "renamed" },
      ],
      questions: ["q_1", "q_5", "q_404"],
    },
  });
  const after = run<{
    day: { title: string; kind: string; hours: number };
    tasks: { id: number; body: string; done: boolean }[];
  }>("plan.editDay", { dayId: day });
  ok(
    save.ok &&
      save.questions === 1 &&
      save.dropped === 2 &&
      after.day.title === "Edited" &&
      after.day.kind === "light" &&
      after.day.hours === 2 &&
      after.tasks.map((t) => t.body).join() === "brand new,renamed",
    "plan.saveDay: saves the details, the task order and only linkable questions",
  );
  ok(
    after.tasks.find((t) => t.body === "renamed")!.done && !after.tasks.find((t) => t.body === "brand new")!.done,
    "plan.saveDay: a tick follows its task when tasks are renamed or reordered",
  );
  ok(
    n("SELECT count(*) AS n FROM plan_tasks WHERE day_id = ?", [day]) === 2 &&
      n("SELECT tasks_total AS n FROM plan_day_progress WHERE day_id = ?", [day]) === 2,
    "plan.saveDay: removed tasks are deleted and the progress counts follow",
  );
  const locked = run<{ ok: boolean }>("plan.saveDay", { ...clock, dayId: past.id, form: { ...form, title: "X" } });
  const lateToday = days.find((x) => x.on_date === today);
  ok(
    !locked.ok &&
      (!lateToday ||
        !run<{ ok: boolean }>("plan.saveDay", { today, hour: 10, dayId: lateToday.id, form: { ...form, title: "X" } })
          .ok),
    "plan.saveDay: a past day, and today after the lock hour, are refused",
  );
  const free = (() => {
    const taken = new Set(days.map((x) => x.on_date));
    for (let i = 1; i < 60; i++) if (!taken.has(addDays(today, i))) return addDays(today, i);
    return null;
  })();
  const plan = d.query("SELECT starts_on, ends_on FROM plans").get() as { starts_on: string; ends_on: string };
  if (free && free <= plan.ends_on) {
    const add = run<{ ok: boolean; dayId: number }>("plan.addDay", { date: free });
    ok(
      add.ok && n("SELECT count(*) AS n FROM plan_tasks WHERE day_id = ?", [add.dayId]) === 1,
      "plan.addDay: a free date gets a new day with one task",
    );
    ok(!run<{ ok: boolean }>("plan.addDay", { date: free }).ok, "plan.addDay: a date already planned is refused");
    ok(
      run<{ ok: boolean }>("plan.deleteDay", { ...clock, dayId: add.dayId }).ok &&
        n("SELECT count(*) AS n FROM plan_tasks WHERE day_id = ?", [add.dayId]) === 0,
      "plan.deleteDay: deletes a day with its tasks",
    );
  }
  ok(
    !run<{ ok: boolean }>("plan.addDay", { date: addDays(plan.ends_on, 1) }).ok,
    "plan.addDay: outside the plan refused",
  );
  ok(!run<{ ok: boolean }>("plan.deleteDay", { ...clock, dayId: past.id }).ok, "plan.deleteDay: a past day is refused");
  ok(
    run<{ ok: boolean }>("plan.saveDetails", { name: " New name ", description: "" }).ok &&
      (d.query("SELECT name, description FROM plans").get() as { name: string; description: null }).name ===
        "New name" &&
      !run<{ ok: boolean }>("plan.saveDetails", { name: " ", description: "" }).ok,
    "plan.saveDetails: renames the plan; a blank name is refused",
  );
  const hits = run<{ id: string }[]>("plan.findQuestions", { search: "WORD2" });
  const byIds = run<{ id: string }[]>("plan.findQuestions", { search: "", ids: ["q_3", "q_5", "q_1"] });
  ok(
    hits.length === 1 && hits[0].id === "q_2" && byIds.map((h) => h.id).join() === "q_3,q_1",
    "plan.findQuestions: by text (any case), or by ids in their order (mock questions left out)",
  );
}
