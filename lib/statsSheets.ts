import { bankSize } from "./packs";
// Turns the statistics into the sheets of the Excel export.
import { PackData } from "./packs";
import { Ev, Filters, activity, breakdown, insights, mockScores, tagStats } from "./stats";
import { Attempt } from "./types";
import { PlanData } from "./plan";
import {
  DIFFICULTIES, MASTERY_HELP, MASTERY_LABEL, MASTERY_ORDER, adherenceSummary, byDifficulty, byHour, byMarks, bySource, byType, byWeekday, headline,
  linkProgress, linkTotals, masteryByTopic, planAdherence, questionDetails, revisionQueue, weekly, examPace, GUESS_MS,
} from "./statsMore";
import { Sheet } from "./xlsx";

const iso = (t: number | null) => (t === null ? "" : new Date(t).toLocaleString("en-CA", { timeZone: "Asia/Kolkata", hour12: false }).replace(",", ""));
const r4 = (x: number | null) => (x === null ? null : Math.round(x * 10000) / 10000);
const sec = (ms: number | null) => (ms === null ? null : Math.round(ms / 100) / 10);

export function statsSheets(args: {
  evs: Ev[]; pack: PackData; attempts: Attempt[]; profile: string; now?: number;
  views?: { q: string; at: number }[]; plan?: PlanData | null; done?: Record<string, boolean>; links?: Record<string, { q: string[]; mock?: string }>;
}): Sheet[] {
  const { evs, pack, attempts, profile, views = [], plan = null, done = {}, links = {} } = args;
  const now = args.now ?? Date.now();
  const b = breakdown(evs, pack, now);
  const subName = (id: string) => pack.subjects[id] ?? id;
  const act = activity(evs, now);
  const answered = evs.filter((e) => e.out !== "skip");
  const right = answered.filter((e) => e.out === "right").length;

  const details = questionDetails(pack, evs, views, now);
  const h = headline(evs, views, details);
  const pc = (x: number | null) => (x === null ? "n/a" : `${Math.round(x * 100)}%`);
  const sc = (x: number | null) => (x === null ? "n/a" : `${Math.round(x * 10) / 10} s`);
  const summary: Sheet = {
    name: "Summary", noHeader: true, widths: [34, 70],
    rows: [
      ["Orbit statistics", ""],
      ["Profile", profile], ["Question pack", pack.name], ["Exported", iso(now)],
      ["", ""],
      ["Encounters (answers + skips)", evs.length], ["Different questions seen", new Set(evs.map((e) => e.q)).size], ["Questions in the pack (practice + mock tests)", bankSize(pack)],
      ["Overall accuracy (right / answered)", answered.length ? `${Math.round((right / answered.length) * 100)}%` : "n/a"],
      ["Active days", act.activeDays], ["Current streak (days)", act.current], ["Best streak (days)", act.best],
      ["", ""], ["Progress", ""],
      ["Question views (practice)", h.views], ["Answered", h.answered], ["Right", h.right], ["Wrong", h.wrong], ["Skipped (views not answered, plus unanswered mock questions)", h.skipped],
      ["First-try accuracy (first answer to each question)", `${pc(h.firstTryAcc)} of ${h.firstTryN} questions`],
      ["Recovery rate (wrong once, right later)", `${pc(h.recovery)} of ${h.recoveryN} questions`],
      ["Average time on a right answer", sc(h.avgSecRight)], ["Average time on a wrong answer", sc(h.avgSecWrong)],
      [`Quick wrong answers (under ${GUESS_MS / 1000} s, likely guesses)`, `${pc(h.guessShare)} of wrong answers (${h.guessN})`],
      ["Practice time (minutes)", Math.round(h.timeSec / 60)], [`Seconds per mark${examPace(pack) !== null ? ` (your mock tests allow about ${examPace(pack)})` : ""}`, h.avgSecPerMark === null ? "n/a" : Math.round(h.avgSecPerMark)],
      ["Marks earned", h.earned], ["Marks lost to negative marking", h.lost], ["Net marks", h.net],
      ["Answers per active day", h.perActiveDay === null ? "n/a" : Math.round(h.perActiveDay * 10) / 10],
      ...MASTERY_ORDER.map((m) => [`Questions: ${MASTERY_LABEL[m]}`, h.mastery[m]] as [string, number]),
      ["Questions due for revision today", h.due],
      ...(plan && Object.keys(links).length ? ((l) => [["Linked questions answered (all plan days)", `${l.answered} of ${l.total}`], ["Linked questions not answered on days already past", l.pastLeft]] as [string, string | number][])(linkTotals(linkProgress(plan, links, evs, act.today))) : []),
      ["", ""], ["Findings", ""],
      ...insights(evs, b, now).map((t, i) => [`${i + 1}`, t] as [string, string]),
    ],
  };

  const subjects: Sheet = {
    name: "Subjects", widths: [26, 11, 8, 8, 9, 11, 11, 14, 12, 14, 18],
    formats: [undefined, "int", "int", "int", "int", "pct", "pct", "dec", "pct", "pct", undefined],
    rows: [["Subject", "Encounters", "Right", "Wrong", "Skipped", "Accuracy", "Skip rate", "Avg seconds", "Coverage", "Trend (14d)", "Last seen"],
      ...b.subjects.map((s) => [s.name, s.m.n, s.m.right, s.m.wrong, s.m.skip, r4(s.m.acc), r4(s.m.skipRate), sec(s.m.avgMs), r4(s.m.coverage), r4(s.m.trend), iso(s.m.last)])],
  };

  const topics: Sheet = {
    name: "Topics", widths: [28, 26, 11, 11, 8, 8, 9, 11, 11, 14, 12, 14, 18],
    formats: [undefined, undefined, undefined, "int", "int", "int", "int", "pct", "pct", "dec", "pct", "pct", undefined],
    rows: [["Subject", "Topic", "Your status", "Encounters", "Right", "Wrong", "Skipped", "Accuracy", "Skip rate", "Avg seconds", "Coverage", "Trend (14d)", "Last seen"],
      ...b.topics.map((t) => [subName(t.parent ?? ""), t.name, t.status ?? "", t.m.n, t.m.right, t.m.wrong, t.m.skip, r4(t.m.acc), r4(t.m.skipRate), sec(t.m.avgMs), r4(t.m.coverage), r4(t.m.trend), iso(t.m.last)])],
  };

  const topicName = (id: string | undefined) => pack.topics.find((t) => t.id === id)?.name ?? id ?? "";
  const questions: Sheet = {
    name: "Questions", widths: [22, 20, 24, 26, 24, 7, 7, 11, 8, 8, 9, 11, 12, 18, 60],
    formats: [undefined, undefined, undefined, undefined, undefined, undefined, "int", "int", "int", "int", "int", "pct", "dec", undefined, undefined],
    rows: [["Question id", "Bank", "Subject", "Topic", "Tags", "Type", "Marks", "Encounters", "Right", "Wrong", "Skipped", "Accuracy", "Avg seconds", "Last seen", "Question text"],
      ...b.questions.map((q) => [q.id, q.mock ? `Mock: ${q.mock}` : "Practice", subName(q.q?.subject ?? pack.topics.find((t) => t.id === q.parent)?.subject ?? "other"), topicName(q.parent), q.tags.join(", "), q.q?.type ?? "", q.q?.marks ?? null, q.m.n, q.m.right, q.m.wrong, q.m.skip, r4(q.m.acc), sec(q.m.avgMs), iso(q.m.last), (q.q?.text ?? "").replace(/\s+/g, " ").slice(0, 300)])],
  };

  const tags: Sheet = {
    name: "Tags", widths: [24, 11, 8, 8, 9, 11, 11, 14],
    formats: [undefined, "int", "int", "int", "int", "pct", "pct", "dec"],
    rows: [["Tag", "Encounters", "Right", "Wrong", "Skipped", "Accuracy", "Skip rate", "Avg seconds"],
      ...tagStats(evs, pack, now).map((t) => [t.tag, t.m.n, t.m.right, t.m.wrong, t.m.skip, r4(t.m.acc), r4(t.m.skipRate), sec(t.m.avgMs)])],
  };

  const daily: Sheet = {
    name: "Daily activity", widths: [14, 12, 8, 10],
    formats: [undefined, "int", "int", "pct"],
    rows: [["Date", "Encounters", "Right", "Accuracy"], ...[...act.per.entries()].sort().map(([d, v]) => [d, v.n, v.right, r4(v.n ? v.right / v.n : null)])],
  };

  const mocks: Sheet = {
    name: "Mocks", widths: [34, 18, 10, 10, 10],
    formats: [undefined, undefined, "dec", "int", "pct"],
    rows: [["Mock", "Finished", "Marks", "Out of", "Score"], ...mockScores(attempts).map((m) => [m.title, iso(m.at), Math.round(m.got * 100) / 100, m.max, r4(m.pct)])],
  };

  const detail: Sheet = {
    name: "Question detail", widths: [22, 20, 22, 26, 10, 7, 7, 8, 9, 8, 8, 9, 11, 11, 9, 11, 11, 10, 18, 11, 18, 9, 10, 10, 12, 60],
    formats: [undefined, undefined, undefined, undefined, undefined, undefined, "int", "int", "int", "int", "int", "int", undefined, undefined, "int", "int", "dec", "dec", undefined, "int", undefined, undefined, "int", undefined, "dec", undefined],
    rows: [["Question id", "Bank", "Subject", "Topic", "Difficulty", "Type", "Marks", "Views", "Answered", "Right", "Wrong", "Skipped", "First try", "Latest answer", "Right in a row", "Tries to first right", "Avg sec (right)", "Avg sec (wrong)", "Level", "Days since seen", "Next review", "Due now", "Overdue days", "Repeated wrong option", "Net marks", "Question text"],
      ...details.map((d) => [d.id, d.bank, subName(d.subject), d.topicName, d.difficulty, d.type, d.marks, d.views, d.answered, d.right, d.wrong, d.skipped, d.firstTry, d.last, d.streak, d.triesToFirstRight, sec(d.avgSecRight === null ? null : d.avgSecRight * 1000), sec(d.avgSecWrong === null ? null : d.avgSecWrong * 1000), MASTERY_LABEL[d.mastery], d.daysSince, iso(d.nextReview), d.due ? "yes" : "", d.daysOverdue || null, d.trapCount >= 2 ? `${d.trap} (${d.trapCount}×)` : "", d.net, d.text.replace(/\s+/g, " ").slice(0, 200)])],
  };

  const mastery: Sheet = {
    name: "Mastery by topic", widths: [28, 28, 11, ...MASTERY_ORDER.map(() => 14), 12, 10],
    formats: [undefined, undefined, "int", ...MASTERY_ORDER.map(() => "int" as const), "pct", "int"],
    rows: [["Subject", "Topic", "Questions", ...MASTERY_ORDER.map((m) => MASTERY_LABEL[m]), "Mastered share", "Due now"],
      ...masteryByTopic(pack, details).map((t) => [t.subject, t.name, t.total, ...MASTERY_ORDER.map((m) => t.counts[m]), r4(t.masteredShare), t.due]),
      ["", "", null, ...MASTERY_ORDER.map(() => null), null, null],
      ["Levels explained", "", null, ...MASTERY_ORDER.map((m) => MASTERY_HELP[m]), null, null]],
  };

  const queue: Sheet = {
    name: "Revision queue", widths: [22, 28, 14, 12, 12, 12, 18, 60],
    formats: [undefined, undefined, undefined, "int", "int", "int", undefined, undefined],
    rows: [["Question id", "Topic", "Level", "Overdue days", "Right in a row", "Wrong so far", "Was due", "Question text"],
      ...revisionQueue(details).map((d) => [d.id, d.topicName, MASTERY_LABEL[d.mastery], d.daysOverdue, d.streak, d.wrong, iso(d.nextReview), d.text.replace(/\s+/g, " ").slice(0, 200)])],
  };

  const grp = (label: string, rows: ReturnType<typeof byType>) => rows.map((g) => [label, g.key, g.m.n, g.m.right, g.m.wrong, g.m.skip, r4(g.m.acc), r4(g.m.skipRate), sec(g.m.avgMs), g.net]);
  const breakdowns: Sheet = {
    name: "Difficulty, type, marks", widths: [14, 16, 11, 8, 8, 9, 11, 11, 14, 11],
    formats: [undefined, undefined, "int", "int", "int", "int", "pct", "pct", "dec", "dec"],
    rows: [["Cut by", "Group", "Encounters", "Right", "Wrong", "Skipped", "Accuracy", "Skip rate", "Avg seconds", "Net marks"],
      ...grp("Difficulty", byDifficulty(evs).filter((g) => DIFFICULTIES.includes(g.key))), ...grp("Question type", byType(evs)), ...grp("Marks", byMarks(evs)), ...grp("Source", bySource(evs))],
  };

  const weeks: Sheet = {
    name: "Weekly trend", widths: [14, 11, 8, 9, 11, 12, 12],
    formats: [undefined, "int", "int", "int", "pct", "int", "int"],
    rows: [["Week starting (Mon)", "Answered", "Right", "Skipped", "Accuracy", "Practice minutes", "Active days"], ...weekly(evs).map((w) => [w.start, w.n, w.right, w.skips, r4(w.acc), w.minutes, w.activeDays])],
  };

  const slotRows = (label: string, a: ReturnType<typeof byHour>) => a.map((x) => [label, x.label, x.n, x.right, r4(x.acc), x.avgSec === null ? null : Math.round(x.avgSec * 10) / 10]);
  const clock: Sheet = {
    name: "Time of day", widths: [12, 14, 10, 8, 11, 14], formats: [undefined, undefined, "int", "int", "pct", "dec"],
    rows: [["Cut by", "Slot (IST)", "Answered", "Right", "Accuracy", "Avg seconds"], ...slotRows("Hour", byHour(evs)), ...slotRows("Weekday", byWeekday(evs))],
  };

  const lp = plan ? linkProgress(plan, links, evs, act.today) : [];
  const lt = linkTotals(lp);
  const linked: Sheet = {
    name: "Linked questions", widths: [14, 36, 10, 10, 10, 10, 10, 12, 14, 20],
    formats: [undefined, undefined, undefined, "int", "int", "int", "int", "int", "int", undefined],
    rows: [["Date", "Plan day", "Day type", "Linked questions", "Answered", "Right now", "Wrong now", "Not answered", "Answered on the day", "Linked mock"],
      ...lp.map((r) => [r.date, r.title, r.past ? r.kind : `${r.kind} (upcoming)`, r.total, r.answered, r.right, r.wrong, r.left, r.onDay, r.mock]),
      ["", "", "", null, null, null, null, null, null, ""],
      ["All linked days", `${lt.days} days`, "", lt.total, lt.answered, lt.right, lt.wrong, lt.left, null, ""],
      ["Not answered on days already past", "", "", null, null, null, null, lt.pastLeft, null, ""]],
  };

  const out = [summary, subjects, topics, questions, detail, mastery, queue, tags, breakdowns, daily, weeks, clock, mocks];
  if (lp.length) out.splice(out.length - 1, 0, linked);
  if (plan && plan.days.length) {
    const rows = planAdherence(plan, done, links, evs, act.today);
    const a = adherenceSummary(rows);
    out.push({
      name: "Plan adherence", widths: [14, 10, 8, 10, 10, 10, 8, 10, 10, 14, 14, 20],
      formats: [undefined, undefined, "dec", "int", "int", undefined, "int", "int", "int", "int", undefined, undefined],
      rows: [["Date", "Day type", "Hours", "Target questions", "Answered", "Target met", "Tasks", "Tasks ticked", "Linked questions", "Linked answered", "Linked mock", ""],
        ...rows.map((d) => [d.date, d.kind, d.hours, d.target, d.answered, d.met === null ? "" : d.met ? "yes" : "no", d.tasks, d.ticked, d.linked, d.linkedAnswered, d.mock, ""]),
        ["", "", null, null, null, "", null, null, null, null, "", ""],
        ["Summary", "", null, null, null, "", null, null, null, null, "", ""],
        ["Days with a target met", `${a.targetMet} of ${a.targetDays}`, null, null, null, pc(a.targetRate), null, null, null, null, "", ""],
        ["Tasks ticked", "", null, null, null, pc(a.taskRate), null, null, null, null, "", ""],
        ["Linked questions answered on their day", "", null, null, null, pc(a.linkedRate), null, null, null, null, "", ""]],
    });
  }
  return out;
}
export type { Filters };
