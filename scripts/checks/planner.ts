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
import { transaction } from "@/lib/db/sql";
import { ok, freshDb, bunSql } from "@/scripts/checks/helpers";

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
