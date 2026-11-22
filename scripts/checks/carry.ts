// check.ts section: carry-over (docs/PLANS.md §5) and a plan day's sitting. Run: bun run check
import { CARRY_DAYS, carriedSlice, carryChunks, dayEnd, pendingAtEnd } from "@/lib/carry";
import { carriedInto } from "@/lib/db/queries/carry";
import { QUERIES, type QueryDef } from "@/lib/db/queries";
import { transaction } from "@/lib/db/sql";
import type { DayQuestions } from "@/lib/questions";
import { ok, freshDb, bunSql, seed, at } from "@/scripts/checks/helpers";

console.log("carry-over rules (lib/carry.ts)");
{
  const j = (x: unknown) => JSON.stringify(x);
  ok(CARRY_DAYS === 3, "work carries over the next 3 planned days");
  ok(
    j(carryChunks(5, 3)) ===
      j([
        [0, 2],
        [2, 4],
        [4, 5],
      ]),
    "5 items over 3 days: 2, 2, 1 (earlier days get the extra)",
  );
  ok(
    j(carryChunks(4, 3)) ===
      j([
        [0, 2],
        [2, 3],
        [3, 4],
      ]),
    "4 items over 3 days: 2, 1, 1",
  );
  ok(
    j(carryChunks(1, 3)) ===
      j([
        [0, 1],
        [1, 1],
        [1, 1],
      ]),
    "1 item goes to the next day only",
  );
  ok(
    j(carryChunks(3, 2)) ===
      j([
        [0, 2],
        [2, 3],
      ]),
    "fewer than 3 days left: the split uses the ones there are",
  );
  ok(carryChunks(4, 0).length === 0 && carriedSlice([1, 2], 0, 0).length === 0, "no days left: nothing carries");
  ok(j(carriedSlice(["a", "b", "c", "d", "e"], 3, 1)) === j(["c", "d"]), "carriedSlice: the j-th day's chunk");
  ok(carriedSlice(["a"], 3, 5).length === 0, "carriedSlice: past the last day = nothing");
  ok(
    dayEnd("2026-11-20") === Date.parse("2026-11-21T00:00:00+05:30") &&
      pendingAtEnd(null, "2026-11-20") &&
      !pendingAtEnd(at("2026-11-20", 23), "2026-11-20") &&
      pendingAtEnd(at("2026-11-21", 0), "2026-11-20"),
    "pendingAtEnd: never ticked, or ticked after the day ended (IST)",
  );
}

console.log("carry-over: reads and a plan day's sitting");
{
  const d = freshDb();
  const s = bunSql(d);
  seed(d, 8);
  const today = "2026-11-20";
  d.exec(`INSERT INTO plans (id, name, starts_on, ends_on, is_active, created_at, updated_at)
          VALUES ('pl_1', 'Plan', '2026-11-01', '2026-11-30', 1, 0, 0)`);
  // planned: 16, 17, 19, 20, 21 (18 is a rest day)
  const dayId: Record<string, number> = {};
  for (const date of ["2026-11-16", "2026-11-17", "2026-11-19", "2026-11-20", "2026-11-21"]) {
    d.query("INSERT INTO plan_days (plan_id, on_date) VALUES ('pl_1', ?)").run(date);
    dayId[date] = (d.query("SELECT id FROM plan_days WHERE on_date = ?").get(date) as { id: number }).id;
  }
  const task = (date: string, body: string, pos: number) => {
    d.query("INSERT INTO plan_tasks (day_id, position, body) VALUES (?, ?, ?)").run(dayId[date], pos, body);
    return (d.query("SELECT id FROM plan_tasks WHERE body = ?").get(body) as { id: number }).id;
  };
  const link = (date: string, q: string, pos: number) =>
    d.query("INSERT INTO plan_day_questions (day_id, question_id, position) VALUES (?, ?, ?)").run(dayId[date], q, pos);
  const answer = (q: string, when: number) =>
    d.query("INSERT INTO question_answers (question_id, recorded_at, outcome) VALUES (?, ?, 'correct')").run(q, when);

  // the 16th: 5 tasks (t1 done on time, t2 done late), 4 questions (q_0 answered on time)
  const t = ["t1", "t2", "t3", "t4", "t5"].map((b, i) => task("2026-11-16", b, i + 1));
  d.query("INSERT INTO plan_task_ticks (task_id, done_at) VALUES (?, ?), (?, ?)").run(
    t[0],
    at("2026-11-16", 20),
    t[1],
    at("2026-11-18", 9),
  );
  ["q_0", "q_1", "q_2", "q_3"].forEach((q, i) => link("2026-11-16", q, i + 1));
  answer("q_0", at("2026-11-16", 21));
  // the 17th: one task, never done; the 19th: one task, never done; the 20th: one question of its own
  task("2026-11-17", "s1", 1);
  const u1 = task("2026-11-19", "u1", 1);
  link("2026-11-20", "q_4", 1);

  const run = <R>(name: keyof typeof QUERIES, params?: unknown) =>
    transaction(s, () => (QUERIES[name] as unknown as QueryDef<unknown, R>).run(s, params));
  const n = (q: string, p: unknown[] = []) => (d.query(q).get(...(p as never[])) as { n: number }).n;

  ok(carriedInto(s, "pl_1", "2026-11-17").tasks.length === 0, "nothing is bonus work until plan.carry runs");
  const first = run<{ days: number; placed: number }>("plan.carry", { today });
  ok(first.days === 3 && first.placed === 9, "plan.carry places the closed days' unfinished work (3 days, 9 items)");
  ok(
    run<{ placed: number }>("plan.carry", { today }).placed === 0 && n("SELECT count(*) AS n FROM plan_bonus") === 9,
    "a second run the same day does nothing",
  );
  ok(
    (d.query("SELECT carried_before AS c FROM plans").get() as { c: string }).c === today,
    "plans.carried_before = the day it ran",
  );

  const into = (date: string) => carriedInto(s, "pl_1", date);
  const names = (date: string) =>
    into(date)
      .tasks.map((x) => x.body)
      .join();
  const qs = (date: string) =>
    into(date)
      .questions.map((x) => x.id)
      .join();

  // the 16th left t2..t5 (4) and q_1..q_3 (3) for the 17th, 19th, 20th: tasks 2, 1, 1; questions 1, 1, 1
  ok(names("2026-11-17") === "t2,t3" && qs("2026-11-17") === "q_1", "the next planned day gets the first chunk");
  ok(
    into("2026-11-17").tasks[0].done && !into("2026-11-17").tasks[1].done,
    "a task done late still carries, shown as done",
  );
  ok(
    names("2026-11-19") === "t4,s1" && qs("2026-11-19") === "q_2",
    "rest days are skipped; each source day's share, oldest first",
  );
  ok(names("2026-11-20") === "t5,u1" && qs("2026-11-20") === "q_3", "the 3rd planned day after gets the last chunk");
  ok(
    names("2026-11-21") === "" && qs("2026-11-21") === "",
    "nothing past 3 planned days; today (not closed) doesn't carry yet; carried items carry once",
  );
  ok(names("2026-11-18") === "" && qs("2026-11-18") === "", "a rest day gets nothing");
  ok(
    !into("2026-11-16").tasks.some((x) => x.body === "t1") && !into("2026-11-17").questions.some((x) => x.id === "q_0"),
    "work done on its own day doesn't carry",
  );
  ok(
    n("SELECT tasks_total AS n FROM plan_day_progress WHERE day_id = ?", [dayId["2026-11-17"]]) === 1,
    "the receiving day's status counts only its own items",
  );

  const dayData = run<{ carried: { tasks: { id: number }[]; questions: { id: string }[] } }>("dashboard.day", {
    date: "2026-11-20",
    today,
  });
  ok(dayData.carried.tasks.length === 2 && dayData.carried.questions.length === 1, "dashboard.day returns `carried`");

  // ticking a carried task ticks the original, so its own day moves on
  run("plan.tickTask", { taskId: u1, done: true });
  ok(
    n("SELECT tasks_done AS n FROM plan_day_progress WHERE day_id = ?", [dayId["2026-11-19"]]) === 1 &&
      names("2026-11-20") === "t5,u1" &&
      into("2026-11-20").tasks[1].done,
    "ticking a carried task ticks its own day; it stays carried, shown as done",
  );

  // a plan day's sitting: its own questions, then the bonus (carried) ones, marked with their day
  const sit = run<DayQuestions>("question.day", { date: "2026-11-20", today });
  ok(
    sit.topic !== null && sit.items.map((x) => x.question.id).join() === "q_4,q_3",
    "question.day: the day's own questions, then the bonus ones",
  );
  ok(
    JSON.stringify(sit.bonus) === JSON.stringify({ q_3: "2026-11-16" }),
    "question.day: each bonus question with the day it came from",
  );
  ok(
    run<DayQuestions>("question.day", { date: "2026-11-16", today })
      .items.map((x) => x.question.id)
      .join() === "q_0,q_1,q_2,q_3",
    "question.day: a past day still lists all its questions",
  );
  answer("q_3", at(today, 10));
  ok(
    n("SELECT count(*) AS n FROM plan_question_ticks WHERE day_id = ? AND question_id = 'q_3'", [
      dayId["2026-11-16"],
    ]) === 1 && qs("2026-11-20") === "q_3",
    "answering a carried question ticks it on its own day; it stays carried",
  );
  ok(
    run<DayQuestions>("question.day", { date: "2026-11-18", today }).topic === null,
    "question.day: a date that isn't a plan day = nothing",
  );
  const empty = run<DayQuestions>("question.day", { date: "2026-11-21", today });
  ok(empty.topic !== null && empty.items.length === 0, "question.day: a plan day with nothing linked = no items");

  // ----- moving and removing bonus work (Edit plan) -----
  type Res = { ok: boolean; error?: string; bonusId?: number; from?: string; to?: string; row?: unknown };
  const clock = { today, hour: 8 }; // before the lock hour: today is still open
  const t5 = into("2026-11-20").tasks.find((x) => x.body === "t5")!.bonusId;
  const moved = run<Res>("plan.moveBonus", { ...clock, bonusId: t5, to: "2026-11-21" });
  ok(
    moved.ok && names("2026-11-21") === "t5" && names("2026-11-20") === "u1" && moved.from === "2026-11-20",
    "Move puts a bonus item on another day and says where it was",
  );
  ok(
    !run<Res>("plan.moveBonus", { ...clock, bonusId: t5, to: "2026-11-19" }).ok &&
      !run<Res>("plan.moveBonus", { ...clock, bonusId: t5, to: "2026-11-18" }).ok,
    "Move refuses a locked (past) day and a date that isn't planned",
  );
  run("plan.unmoveBonus", { bonusId: t5, to: "2026-11-20" });
  ok(names("2026-11-20") === "u1,t5" && names("2026-11-21") === "", "Undo of a move puts it back");
  const u1b = into("2026-11-20").tasks.find((x) => x.body === "u1")!.bonusId;
  const removed = run<Res>("plan.removeBonus", { bonusId: u1b });
  ok(removed.ok && names("2026-11-20") === "t5", "Remove takes a bonus item off its day");
  ok(n("SELECT count(*) AS n FROM plan_tasks WHERE id = ?", [u1]) === 1, "a removed bonus item stays on its own day");
  run("plan.carry", { today: "2026-11-21" });
  ok(
    !names("2026-11-21").includes("u1") && !names("2026-11-20").includes("u1"),
    "a removed item isn't carried again the next day",
  );
  ok(qs("2026-11-21") === "q_4", "the next day's run carries the day that just closed (the 20th's own question)");
  run("plan.restoreBonus", { row: removed.row });
  ok(names("2026-11-20") === "u1,t5" || names("2026-11-20") === "t5,u1", "Undo of Remove puts it back");

  // ----- export → import keeps bonus work; a JSON patch moves it -----
  type Exported = { file: { days: { date: string; bonus?: unknown[] }[]; carried_before?: string }; bonus: number };
  const ex = run<Exported>("plan.export");
  const day20 = ex.file.days.find((x) => x.date === "2026-11-20");
  ok(
    ex.bonus === n("SELECT count(*) AS n FROM plan_bonus") &&
      (day20?.bonus?.length ?? 0) === 3 &&
      ex.file.carried_before === "2026-11-21",
    "Export plan writes each day's bonus work and carried_before",
  );
  const before = (plan: string) =>
    (
      d
        .query(
          `SELECT t.on_date AS day, f.on_date AS "from", coalesce(k.body, b.question_id) AS item FROM plan_bonus b
           JOIN plan_days t ON t.id = b.day_id JOIN plan_days f ON f.id = b.from_day_id
           LEFT JOIN plan_tasks k ON k.id = b.task_id WHERE t.plan_id = ? ORDER BY t.on_date, b.position`,
        )
        .all(plan) as unknown[]
    )
      .map((x) => JSON.stringify(x))
      .join();
  const imported = run<{ ok: boolean; planId: string; bonus: number }>("plan.import", {
    text: JSON.stringify(ex.file),
  });
  ok(
    imported.ok && imported.bonus === ex.bonus && before(imported.planId) === before("pl_1"),
    "importing the export puts the same bonus work on the same days",
  );
  ok(
    run<{ placed: number }>("plan.carry", { today: "2026-11-21" }).placed === 0,
    "an imported plan doesn't carry the days its file says are carried already",
  );
  const patch = JSON.stringify({
    days: [
      {
        date: "2026-11-21",
        title: "Moved here",
        bonus: [
          { from: "2026-11-16", question: "q_3" },
          { from: "2026-11-20", question: "q_4" },
        ],
      },
      { date: "2026-11-22", title: "Bad", bonus: [{ from: "2026-11-16", task: "no such task" }] },
    ],
  });
  const pclock = { today: "2026-11-21", hour: 8 };
  const checked = run<{ errors: string[]; warnings: string[] }>("plan.checkPatch", { ...pclock, text: patch });
  ok(
    checked.errors.length === 0 && checked.warnings.some((w) => w.includes("bonus")),
    "plan.checkPatch warns about a bonus entry that matches nothing",
  );
  const applied = run<{ ok: boolean; bonus: number }>("plan.applyPatch", { ...pclock, text: patch });
  const mine = (date: string) =>
    carriedInto(s, imported.planId, date)
      .questions.map((x) => x.id)
      .join();
  ok(
    applied.ok && mine("2026-11-21") === "q_3,q_4" && !mine("2026-11-20").includes("q_3"),
    "a JSON patch's bonus list moves bonus work onto the day from wherever it sat",
  );
  ok(d.query("PRAGMA foreign_key_check").all().length === 0, "bonus work: no foreign key violations");
}

console.log("plan_bonus rules (db/schema.sql)");
{
  const d = freshDb();
  d.exec(`INSERT INTO plans (id, name, starts_on, ends_on, is_active, created_at, updated_at)
          VALUES ('pl_1', 'Plan', '2026-11-01', '2026-11-30', 1, 0, 0);
          INSERT INTO plan_days (id, plan_id, on_date) VALUES (1, 'pl_1', '2026-11-10'), (2, 'pl_1', '2026-11-11');
          INSERT INTO plan_tasks (id, day_id, position, body) VALUES (1, 1, 1, 'a'), (2, 2, 1, 'b');`);
  const refuses = (q: string) => {
    try {
      d.exec(q);
      return false;
    } catch {
      return true;
    }
  };
  ok(
    refuses("INSERT INTO plan_bonus (day_id, position, from_day_id, task_id) VALUES (1, 1, 2, 2)"),
    "a bonus item can't sit on a day before its own",
  );
  ok(
    refuses("INSERT INTO plan_bonus (day_id, position, from_day_id, task_id) VALUES (2, 1, 1, 2)"),
    "a task's from_day_id must be the task's own day",
  );
  ok(
    !refuses("INSERT INTO plan_bonus (day_id, position, from_day_id, task_id) VALUES (2, 1, 1, 1)") &&
      refuses("INSERT INTO plan_bonus (day_id, position, from_day_id, task_id) VALUES (2, 2, 1, 1)"),
    "an item is placed once",
  );
  d.exec("DELETE FROM plan_tasks WHERE id = 1");
  ok(
    (d.query("SELECT count(*) AS n FROM plan_bonus").get() as { n: number }).n === 0,
    "deleting the original removes its bonus row",
  );
}
