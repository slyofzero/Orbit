import { bankSize } from "./packs";
// Turns the statistics into the sheets of the Excel export.
import { PackData } from "./packs";
import { Ev, Filters, activity, breakdown, insights, mockScores, tagStats } from "./stats";
import { Attempt } from "./types";
import { Sheet } from "./xlsx";

const iso = (t: number | null) => (t === null ? "" : new Date(t).toLocaleString("en-CA", { timeZone: "Asia/Kolkata", hour12: false }).replace(",", ""));
const r4 = (x: number | null) => (x === null ? null : Math.round(x * 10000) / 10000);
const sec = (ms: number | null) => (ms === null ? null : Math.round(ms / 100) / 10);

export function statsSheets(args: { evs: Ev[]; pack: PackData; attempts: Attempt[]; profile: string; now?: number }): Sheet[] {
  const { evs, pack, attempts, profile } = args;
  const now = args.now ?? Date.now();
  const b = breakdown(evs, pack, now);
  const subName = (id: string) => pack.subjects[id] ?? id;
  const act = activity(evs, now);
  const answered = evs.filter((e) => e.out !== "skip");
  const right = answered.filter((e) => e.out === "right").length;

  const summary: Sheet = {
    name: "Summary", noHeader: true, widths: [34, 70],
    rows: [
      ["Orbit statistics", ""],
      ["Profile", profile], ["Question pack", pack.name], ["Exported", iso(now)],
      ["", ""],
      ["Encounters (answers + skips)", evs.length], ["Different questions seen", new Set(evs.map((e) => e.q)).size], ["Questions in the pack (practice + mock tests)", bankSize(pack)],
      ["Overall accuracy (right / answered)", answered.length ? `${Math.round((right / answered.length) * 100)}%` : "n/a"],
      ["Active days", act.activeDays], ["Current streak (days)", act.current], ["Best streak (days)", act.best],
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

  return [summary, subjects, topics, questions, tags, daily, mocks];
}
export type { Filters };
