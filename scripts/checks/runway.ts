// check.ts section: runway. Run: bun run check
import { daysBetween } from "@/lib/dates";
import { buildHero, streak } from "@/lib/runway";
import { ok } from "@/scripts/checks/helpers";

console.log("dashboard hero (lib/runway.ts)");
{
  const D = (
    on_date: string,
    status: "done" | "partial" | "incomplete" | null,
    tasks_done = 0,
    tasks_total = 2,
    kind: "study" | "exam" = "study",
  ) => ({ on_date, title: "T " + on_date, kind, status, tasks_done, tasks_total });
  const days = [
    D("2026-11-16", "done", 2),
    D("2026-11-17", "incomplete", 0),
    D("2026-11-18", "done", 2),
    D("2026-11-19", "partial", 2), // tasks done, a linked question still open
    D("2026-11-20", "partial", 1),
  ];
  ok(streak(days, "2026-11-20") === 0, "streak: a past partial day ends it");
  ok(
    streak([D("2026-11-18", "done", 2), D("2026-11-19", null), D("2026-11-20", "partial", 1)], "2026-11-20") === 1,
    "streak: rest days skipped, today not finished doesn't break it",
  );
  ok(
    streak([D("2026-11-19", "done", 2), D("2026-11-20", "done", 2)], "2026-11-20") === 2,
    "streak: today counts once done",
  );
  const ms = [
    { id: 1, name: "Quiz 1", on_date: "2026-11-15" },
    { id: 2, name: "Quiz 2", on_date: "2026-12-05" },
    { id: 3, name: "End Term", on_date: "2027-01-10" },
  ];
  const h = buildHero({
    today: "2026-11-20",
    plan: { starts_on: "2026-11-08", ends_on: "2027-02-07" },
    days,
    milestones: ms,
  });
  ok(
    JSON.stringify(h.headline) === '{"kind":"in","name":"Quiz 2","days":15}',
    "headline counts down to the next milestone",
  );
  ok(
    h.sub === "Day 13 of 92. 1 task left today. After that: End Term in 51 days.",
    "plan note + after that (v1 wording)",
  );
  ok(
    h.ticks[0].date === "2026-11-08" && h.ticks[h.ticks.length - 1].date === "2027-01-10",
    "track runs from the plan's start to the last milestone",
  );
  const st = (d: string) => h.ticks.find((t) => t.date === d)!.state;
  ok(
    st("2026-11-15") === "ms" && st("2026-11-20") === "today" && st("2026-11-21") === "future",
    "milestone, today and future ticks",
  );
  ok(
    st("2026-11-16") === "done" &&
      st("2026-11-17") === "miss" &&
      st("2026-11-19") === "past" &&
      st("2026-11-10") === "past",
    "past ticks: done green, missed red, tasks-done or unplanned plain",
  );
  ok(
    h.flags.find((f) => f.id === 2)!.next &&
      h.flags.find((f) => f.id === 1)!.long === "passed" &&
      h.flags.find((f) => f.id === 3)!.flip,
    "flags: next, passed, flipped at the right end",
  );
  ok(JSON.stringify(h.todayTasks) === '{"done":1,"total":2}', "today's tasks");
  ok(
    buildHero({ today: "2026-11-20", plan: null, days: [], milestones: [] }).headline.kind === "none",
    "no milestones: ask for one",
  );
  ok(
    buildHero({
      today: "2026-11-01",
      plan: { starts_on: "2026-11-03", ends_on: "2026-12-01" },
      days,
      milestones: [],
    }).sub.startsWith("Your plan starts in 2 days: T 2026-11-16."),
    "before the plan starts",
  );
  ok(
    buildHero({ today: "2027-03-01", plan: { starts_on: "2026-11-03", ends_on: "2026-12-01" }, days, milestones: ms })
      .headline.kind === "past",
    "every milestone behind you",
  );
  ok(daysBetween("2026-12-30", "2027-01-02") === 3, "daysBetween across a year");
}
