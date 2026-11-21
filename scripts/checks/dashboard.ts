// check.ts section: dashboard. Run: bun run check
import { formatShort } from "@/lib/dates";
import {
  dayHeading,
  dayHelpPrompt,
  dayLock,
  dayTally,
  focusDay,
  lastDays,
  standingLine,
  topicsLine,
} from "@/lib/dashboard";
import { QUERIES, type QueryDef } from "@/lib/db/queries";
import { transaction } from "@/lib/db/sql";
import { ok, freshDb, bunSql } from "@/scripts/checks/helpers";

console.log("dashboard rules (lib/dashboard.ts)");
{
  ok(
    dayLock("2026-11-20", "2026-11-20", 8) === "open" &&
      dayLock("2026-11-20", "2026-11-20", 9) === "locked" &&
      dayLock("2026-11-19", "2026-11-20", 3) === "locked" &&
      dayLock("2026-11-21", "2026-11-20", 23) === "free",
    "day lock: today open before 9 AM, locked after; past locked; future free",
  );
  ok(
    focusDay("2026-11-20", "done", true) === "2026-11-21" &&
      focusDay("2026-11-20", "done", false) === "2026-11-20" &&
      focusDay("2026-11-20", "partial", true) === "2026-11-20",
    "focus moves to tomorrow only once today is done and tomorrow is planned",
  );
  ok(
    dayHeading("2026-11-20", "2026-11-20") === "Today" &&
      dayHeading("2026-11-21", "2026-11-20") === "Tomorrow" &&
      dayHeading("2026-11-23", "2026-11-20") === "Monday 23 November",
    "day heading",
  );
  const w = lastDays("2026-11-20", { "2026-11-20": 3, "2026-11-14": 1 });
  ok(
    w.length === 7 &&
      w[0].date === "2026-11-14" &&
      w[0].value === 1 &&
      w[0].letter === "S" &&
      w[6].today &&
      w[6].letter === "F" &&
      w[3].value === 0,
    "last 7 days: oldest first, missing days 0, weekday letters",
  );
  ok(
    dayTally(0, 0) === "Nothing done" &&
      dayTally(1, 0) === "1 task ticked" &&
      dayTally(0, 2) === "2 questions answered" &&
      dayTally(3, 1) === "3 tasks ticked · 1 question answered",
    "last 7 days: bar hover text",
  );
  ok(
    standingLine({ hasPlan: false, started: false, openTasks: 0 }) === "No plan loaded yet." &&
      standingLine({ hasPlan: true, started: false, openTasks: 0 }) === "Nothing is due yet." &&
      standingLine({ hasPlan: true, started: true, openTasks: 0 }) === "Everything due so far is done." &&
      standingLine({ hasPlan: true, started: true, openTasks: 1 }) === "1 due so far is still open." &&
      standingLine({ hasPlan: true, started: true, openTasks: 7 }) === "7 due so far are still open.",
    "where you stand: v1 wording",
  );
  ok(
    topicsLine({ topics: 0, fresh: 0, shaky: 0 }) === "" &&
      topicsLine({ topics: 40, fresh: 12, shaky: 1 }) === "Of 40 topics, 12 are new to you and 1 is shaky.",
    "topics line",
  );
  ok(formatShort("2026-11-08") === "8 Nov", "formatShort");
  const dp = dayHelpPrompt({
    date: "2026-11-20",
    kindLabel: "Study",
    hours: 1,
    title: "Limits",
    note: null,
    tasks: ["Read notes", "Solve 5"],
    topics: ["Calculus"],
    questions: 4,
  });
  const bare = dayHelpPrompt({
    date: "2026-11-20",
    kindLabel: "Rest",
    hours: null,
    title: null,
    note: null,
    tasks: [],
    topics: [],
    questions: 0,
  });
  ok(
    dp.includes("Friday 20 November (2026-11-20)") &&
      dp.includes("1 hour.") &&
      dp.includes("1. Read notes\n2. Solve 5") &&
      dp.includes("- Calculus") &&
      dp.includes("4 questions") &&
      bare.includes("(none)") &&
      !bare.includes("Time available") &&
      !bare.includes("TOPICS") &&
      !bare.includes("PRACTICE:"),
    "day help prompt: day, tasks, topics, practice; empty parts left out",
  );

  // the dashboard's read queries over the sample plan
  const d = freshDb();
  const s = bunSql(d);
  const q = <R>(name: keyof typeof QUERIES, params?: unknown) =>
    (QUERIES[name] as unknown as QueryDef<unknown, R>).run(s, params);
  const today = "2026-11-20";
  transaction(s, () => (QUERIES["dev.samplePlan"] as unknown as QueryDef<unknown, unknown>).run(s, { today }));
  const cal = q<{ days: { on_date: string; status: string | null }[]; milestones: unknown[] }>("dashboard.calendar");
  ok(cal.days.length > 70 && cal.milestones.length === 4, "dashboard.calendar: plan days and milestones");
  ok(cal.days.find((x) => x.on_date === "2026-11-19")?.status === "done", "dashboard.calendar: day status");
  const day = q<{ day: { kind: string } | null; tasks: { done: boolean }[]; upcoming: { on_date: string }[] }>(
    "dashboard.day",
    { date: today, today },
  );
  ok(
    day.day !== null && day.tasks.length === 4 && day.tasks[0].done && !day.tasks[1].done,
    "dashboard.day: tasks with ticks",
  );
  ok(
    day.upcoming.length === 4 && day.upcoming.every((u) => u.on_date > today),
    "dashboard.day: up to 4 days coming up after today",
  );
  const sunday = q<{ day: unknown; next: { on_date: string } | null }>("dashboard.day", { date: "2026-11-22", today });
  ok(sunday.day === null && sunday.next?.on_date === "2026-11-23", "dashboard.day: a rest day points at the next one");
  const st = q<{ hasPlan: boolean; started: boolean; tasksTotal: number; tasksDone: number; openTasks: number }>(
    "dashboard.standing",
    { today },
  );
  ok(
    st.hasPlan && st.started && st.tasksTotal > 0 && st.tasksDone > 0 && st.openTasks > 0,
    "dashboard.standing: counts plan tasks done and still open",
  );
  ok(q<unknown[]>("dashboard.milestones").length === 4, "dashboard.milestones");
  ok(
    q<unknown[]>("dashboard.mocks").length === 0 && q<unknown[]>("dashboard.weakest").length === 0,
    "mocks / weakest empty",
  );
  // ticking every task of today makes it "done"; unticking one makes it "partial" again; ticking twice is harmless
  const status = () =>
    q<{ days: { on_date: string; status: string | null }[] }>("dashboard.calendar").days.find(
      (x) => x.on_date === today,
    )?.status;
  const tick = (taskId: number, done: boolean) =>
    transaction(s, () => (QUERIES["plan.tickTask"] as unknown as QueryDef<unknown, unknown>).run(s, { taskId, done }));
  const ids = q<{ tasks: { id: number }[] }>("dashboard.day", { date: today, today }).tasks.map((t) => t.id);
  ok(status() === "partial", "plan.tickTask: today starts partial");
  for (const id of ids) tick(id, true);
  tick(ids[0], true);
  ok(status() === "done", "plan.tickTask: all ticked makes the day done (ticking twice is harmless)");
  tick(ids[1], false);
  const after = q<{ tasks: { done: boolean }[] }>("dashboard.day", { date: today, today }).tasks;
  ok(status() === "partial" && !after[1].done && after[0].done, "plan.tickTask: unticking makes it partial again");
  const week = q<Record<string, { tasks: number; questions: number }>>("dashboard.week", { today });
  ok(
    typeof week === "object" &&
      Object.values(week).every((c) => typeof c.tasks === "number" && typeof c.questions === "number"),
    "dashboard.week: tasks and questions per day",
  );
}
