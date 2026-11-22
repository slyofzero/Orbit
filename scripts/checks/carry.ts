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

  const into = (date: string) => carriedInto(s, "pl_1", date, today);
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
  const n = (q: string, p: unknown[] = []) => (d.query(q).get(...(p as never[])) as { n: number }).n;
  ok(
    n("SELECT tasks_total AS n FROM plan_day_progress WHERE day_id = ?", [dayId["2026-11-17"]]) === 1,
    "the receiving day's status counts only its own items",
  );

  const run = <R>(name: keyof typeof QUERIES, params?: unknown) =>
    transaction(s, () => (QUERIES[name] as unknown as QueryDef<unknown, R>).run(s, params));

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
}
