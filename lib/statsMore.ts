// More statistics, built from the same events as lib/stats.ts plus the view log.
// Pure functions, tested by scripts/check.ts. Everything here also goes into the Excel export (lib/statsSheets.ts).
import { PackData } from "./packs";
import { PlanData } from "./plan";
import { Ev, M, bankQuestions, metrics } from "./stats";
import { difficultyOf } from "./questionFilter";
import { Question } from "./types";

const DAY = 86_400_000;
const istDay = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const istHour = (t: number) => Number(new Date(t).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).slice(0, 2)) % 24;
const shiftDay = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * DAY).toISOString().slice(0, 10);
const weekday = (d: string) => (new Date(Date.parse(d + "T00:00:00Z")).getUTCDay() + 6) % 7; // 0 = Monday

/** Seconds per mark that your own mock tests allow (their total minutes over their total marks), or null when the pack has no mock tests. Used as a pace yardstick. */
export function examPace(pack: PackData): number | null {
  let sec = 0, marks = 0;
  for (const m of pack.mockTests ?? []) { sec += m.minutes * 60; marks += m.sections.reduce((n, s) => n + s.questions.reduce((k, q) => k + q.marks, 0), 0); }
  return marks > 0 ? Math.round(sec / marks) : null;
}
/** Wrong answers given faster than this are probably guesses. */
export const GUESS_MS = 10_000;

export type Mastery = "unseen" | "unanswered" | "struggling" | "slipped" | "learning" | "mastered";
export const MASTERY_ORDER: Mastery[] = ["mastered", "learning", "slipped", "struggling", "unanswered", "unseen"];
export const MASTERY_LABEL: Record<Mastery, string> = {
  mastered: "Mastered", learning: "Learning", slipped: "Slipped", struggling: "Struggling", unanswered: "Seen, not answered", unseen: "Never seen",
};
export const MASTERY_HELP: Record<Mastery, string> = {
  mastered: "Right the last 3 times in a row.",
  learning: "Right the last 1 or 2 times.",
  slipped: "You got it right before, but the latest answer was wrong.",
  struggling: "Wrong every time you tried.",
  unanswered: "You opened it but never answered.",
  unseen: "Never shown to you.",
};

/** Days to wait before seeing a question again, by how many right answers in a row you have. A wrong answer means tomorrow. */
export const reviewGapDays = (streak: number): number => (streak <= 0 ? 1 : streak === 1 ? 3 : streak === 2 ? 7 : streak === 3 ? 14 : 30);

/** Marks one answer is worth: full marks when right, minus the negative mark for a wrong MCQ, nothing for the rest. */
export const netMarks = (e: Pick<Ev, "out" | "type" | "marks" | "got">): number => {
  if (e.got !== undefined) return e.got;
  if (e.out === "right") return e.marks;
  if (e.out === "wrong" && e.type === "mcq") return e.marks === 1 ? -1 / 3 : -2 / 3;
  return 0;
};

const letters = (pick: number | number[]) => (Array.isArray(pick) ? [...pick].sort((a, b) => a - b) : [pick]).map((i) => String.fromCharCode(65 + i)).join("+");

export interface QDetail {
  id: string; bank: string; subject: string; topic: string; topicName: string; difficulty: string; type: string; marks: number; text: string;
  views: number; answered: number; right: number; wrong: number; skipped: number;
  firstTry: "right" | "wrong" | ""; last: "right" | "wrong" | ""; streak: number; triesToFirstRight: number | null;
  avgSecRight: number | null; avgSecWrong: number | null; bestSec: number | null;
  lastSeen: number | null; daysSince: number | null; mastery: Mastery;
  nextReview: number | null; due: boolean; daysOverdue: number;
  trap: string; trapCount: number; net: number;
}

/** One row per question in the pack (practice and mock tests), with its whole history. */
export function questionDetails(pack: PackData, evs: Ev[], views: { q: string; at: number }[], now = Date.now()): QDetail[] {
  const by = new Map<string, Ev[]>();
  for (const e of evs) (by.get(e.q) ?? by.set(e.q, []).get(e.q)!).push(e);
  const seen = new Map<string, number>();
  for (const v of views) seen.set(v.q, (seen.get(v.q) ?? 0) + 1);
  const topicName = (id: string) => pack.topics.find((t) => t.id === id)?.name ?? id;

  return bankQuestions(pack).map((q: Question & { mock?: string }) => {
    const list = (by.get(q.id) ?? []).slice().sort((a, b) => a.at - b.at);
    const ans = list.filter((e) => e.out !== "skip");
    const right = ans.filter((e) => e.out === "right"), wrong = ans.filter((e) => e.out === "wrong");
    let streak = 0;
    for (let i = ans.length - 1; i >= 0 && ans[i].out === "right"; i--) streak++;
    const firstRight = ans.findIndex((e) => e.out === "right");
    const timed = (a: Ev[]) => a.filter((e) => e.src === "practice" && e.ms !== undefined);
    const avg = (a: Ev[]) => { const t = timed(a); return t.length ? t.reduce((s, e) => s + e.ms!, 0) / t.length / 1000 : null; };
    const times = timed(ans).map((e) => e.ms!);
    const lastAns = ans[ans.length - 1];
    const last = lastAns ? (lastAns.out as "right" | "wrong") : "";
    const everRight = right.length > 0;
    const mastery: Mastery = ans.length === 0
      ? ((seen.get(q.id) ?? 0) > 0 || list.length > 0 ? "unanswered" : "unseen")
      : last === "wrong" ? (everRight ? "slipped" : "struggling")
      : streak >= 3 ? "mastered" : "learning";
    const nextReview = lastAns ? lastAns.at + reviewGapDays(last === "right" ? streak : 0) * DAY : null;
    // the wrong option that keeps winning
    const traps = new Map<string, number>();
    for (const e of wrong) if (e.pick !== undefined) { const k = letters(e.pick); traps.set(k, (traps.get(k) ?? 0) + 1); }
    const top = [...traps.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      id: q.id, bank: q.mock ? `Mock: ${q.mock}` : "Practice",
      subject: q.subject ?? pack.topics.find((t) => t.id === q.topic)?.subject ?? "other", topic: q.topic, topicName: topicName(q.topic),
      difficulty: difficultyOf(q) ?? "", type: q.type, marks: q.marks, text: q.text,
      views: seen.get(q.id) ?? 0, answered: ans.length, right: right.length, wrong: wrong.length, skipped: list.filter((e) => e.out === "skip").length,
      firstTry: ans.length ? (ans[0].out as "right" | "wrong") : "", last, streak, triesToFirstRight: firstRight >= 0 ? firstRight + 1 : null,
      avgSecRight: avg(right), avgSecWrong: avg(wrong), bestSec: times.length ? Math.min(...times) / 1000 : null,
      lastSeen: list.length ? list[list.length - 1].at : null, daysSince: list.length ? Math.floor((now - list[list.length - 1].at) / DAY) : null,
      mastery, nextReview, due: nextReview !== null && nextReview <= now, daysOverdue: nextReview !== null && nextReview <= now ? Math.floor((now - nextReview) / DAY) : 0,
      trap: top ? top[0] : "", trapCount: top ? top[1] : 0, net: Math.round(ans.reduce((s, e) => s + netMarks(e), 0) * 100) / 100,
    };
  });
}

export interface Headline {
  views: number; answered: number; right: number; wrong: number; skipped: number;
  firstTryAcc: number | null; firstTryN: number;
  recovery: number | null; recoveryN: number;      // of the questions you once got wrong, how many you later got right
  avgSecRight: number | null; avgSecWrong: number | null;
  guessShare: number | null; guessN: number;       // wrong answers given in under 10 seconds
  timeSec: number; avgSecPerMark: number | null;
  earned: number; lost: number; net: number;
  activeDays: number; perActiveDay: number | null;
  mastery: Record<Mastery, number>; due: number;
}

export function headline(evs: Ev[], views: { q: string; at: number }[], details: QDetail[]): Headline {
  const ans = evs.filter((e) => e.out !== "skip");
  const prac = ans.filter((e) => e.src === "practice" && e.ms !== undefined);
  const secs = (a: Ev[]) => (a.length ? a.reduce((s, e) => s + e.ms!, 0) / a.length / 1000 : null);
  const right = ans.filter((e) => e.out === "right").length, wrong = ans.length - right;
  const ft = details.filter((d) => d.firstTry !== "");
  const hadWrong = details.filter((d) => d.wrong > 0);
  const byQ = new Map<string, Ev[]>();
  for (const e of ans) (byQ.get(e.q) ?? byQ.set(e.q, []).get(e.q)!).push(e);
  const recovered = hadWrong.filter((d) => {
    const l = (byQ.get(d.id) ?? []).sort((a, b) => a.at - b.at);
    const i = l.findIndex((e) => e.out === "wrong");
    return i >= 0 && l.slice(i + 1).some((e) => e.out === "right");
  }).length;
  const quick = prac.filter((e) => e.out === "wrong" && e.ms! < GUESS_MS).length, pracWrong = prac.filter((e) => e.out === "wrong").length;
  const timeSec = prac.reduce((s, e) => s + e.ms!, 0) / 1000;
  const marks = prac.reduce((s, e) => s + e.marks, 0);
  const nets = ans.map((e) => netMarks(e));
  const days = new Set(ans.map((e) => istDay(e.at)));
  const mastery = Object.fromEntries(MASTERY_ORDER.map((m) => [m, 0])) as Record<Mastery, number>;
  for (const d of details) mastery[d.mastery]++;
  return {
    views: views.length, answered: ans.length, right, wrong, skipped: evs.length - ans.length,
    firstTryAcc: ft.length ? ft.filter((d) => d.firstTry === "right").length / ft.length : null, firstTryN: ft.length,
    recovery: hadWrong.length ? recovered / hadWrong.length : null, recoveryN: hadWrong.length,
    avgSecRight: secs(prac.filter((e) => e.out === "right")), avgSecWrong: secs(prac.filter((e) => e.out === "wrong")),
    guessShare: pracWrong ? quick / pracWrong : null, guessN: quick,
    timeSec, avgSecPerMark: marks ? timeSec / marks : null,
    earned: Math.round(nets.filter((n) => n > 0).reduce((s, n) => s + n, 0) * 100) / 100,
    lost: Math.round(nets.filter((n) => n < 0).reduce((s, n) => s + n, 0) * 100) / 100,
    net: Math.round(nets.reduce((s, n) => s + n, 0) * 100) / 100,
    activeDays: days.size, perActiveDay: days.size ? ans.length / days.size : null,
    mastery, due: details.filter((d) => d.due).length,
  };
}

export interface Group { key: string; m: M; net: number }
/** Numbers cut by any one property of an encounter: difficulty, question type, marks, practice or mock. */
export function groupStats(evs: Ev[], key: (e: Ev) => string, order?: string[]): Group[] {
  const g = new Map<string, Ev[]>();
  for (const e of evs) { const k = key(e); (g.get(k) ?? g.set(k, []).get(k)!).push(e); }
  const rows = [...g.entries()].map(([k, list]) => ({ key: k, m: metrics(list), net: Math.round(list.reduce((s, e) => s + netMarks(e), 0) * 100) / 100 }));
  return rows.sort((a, b) => (order ? order.indexOf(a.key) - order.indexOf(b.key) : b.m.n - a.m.n));
}
export const DIFFICULTIES = ["easy", "medium", "hard", "none"];
export const byDifficulty = (evs: Ev[]) => groupStats(evs, (e) => DIFFICULTIES.find((d) => e.tags.includes(d)) ?? "none", DIFFICULTIES);
export const byType = (evs: Ev[]) => groupStats(evs, (e) => e.type, ["mcq", "msq", "nat", "str", "code"]);
export const byMarks = (evs: Ev[]) => groupStats(evs, (e) => `${e.marks} mark${e.marks > 1 ? "s" : ""}`, ["1 mark", "2 marks"]);
export const bySource = (evs: Ev[]) => groupStats(evs, (e) => (e.src === "mock" ? "Mock tests" : "Practice"), ["Practice", "Mock tests"]);

export interface Week { start: string; n: number; right: number; skips: number; acc: number | null; minutes: number; activeDays: number }
/** One row per calendar week (Monday start, IST), oldest first, empty weeks in between included. */
export function weekly(evs: Ev[]): Week[] {
  if (!evs.length) return [];
  const w = new Map<string, { n: number; right: number; skips: number; ms: number; days: Set<string> }>();
  for (const e of evs) {
    const d = istDay(e.at), start = shiftDay(d, -weekday(d));
    const v = w.get(start) ?? { n: 0, right: 0, skips: 0, ms: 0, days: new Set<string>() };
    if (e.out === "skip") v.skips++; else { v.n++; if (e.out === "right") v.right++; v.days.add(d); if (e.src === "practice" && e.ms) v.ms += e.ms; }
    w.set(start, v);
  }
  const keys = [...w.keys()].sort();
  const out: Week[] = [];
  for (let s = keys[0]; s <= keys[keys.length - 1]; s = shiftDay(s, 7)) {
    const v = w.get(s);
    out.push({ start: s, n: v?.n ?? 0, right: v?.right ?? 0, skips: v?.skips ?? 0, acc: v && v.n ? v.right / v.n : null, minutes: v ? Math.round(v.ms / 60_000) : 0, activeDays: v?.days.size ?? 0 });
  }
  return out;
}

export interface Slot { label: string; n: number; right: number; acc: number | null; avgSec: number | null }
const slots = (evs: Ev[], count: number, key: (e: Ev) => number, label: (i: number) => string): Slot[] => {
  const s = Array.from({ length: count }, () => ({ n: 0, right: 0, ms: 0, msN: 0 }));
  for (const e of evs) if (e.out !== "skip") { const v = s[key(e)]; v.n++; if (e.out === "right") v.right++; if (e.src === "practice" && e.ms) { v.ms += e.ms; v.msN++; } }
  return s.map((v, i) => ({ label: label(i), n: v.n, right: v.right, acc: v.n ? v.right / v.n : null, avgSec: v.msN ? v.ms / v.msN / 1000 : null }));
};
export const byHour = (evs: Ev[]): Slot[] => slots(evs, 24, (e) => istHour(e.at), (i) => `${String(i).padStart(2, "0")}:00`);
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const byWeekday = (evs: Ev[]): Slot[] => slots(evs, 7, (e) => weekday(istDay(e.at)), (i) => WEEKDAYS[i]);

export interface TopicMastery { topic: string; name: string; subject: string; total: number; counts: Record<Mastery, number>; masteredShare: number; due: number }
/** How many questions of each topic are in each mastery state. Practice-bank questions only. */
export function masteryByTopic(pack: PackData, details: QDetail[]): TopicMastery[] {
  const practice = details.filter((d) => d.bank === "Practice");
  return pack.topics.map((t) => {
    const mine = practice.filter((d) => d.topic === t.id);
    const counts = Object.fromEntries(MASTERY_ORDER.map((m) => [m, 0])) as Record<Mastery, number>;
    for (const d of mine) counts[d.mastery]++;
    return { topic: t.id, name: t.name, subject: pack.subjects[t.subject] ?? t.subject, total: mine.length, counts, masteredShare: mine.length ? counts.mastered / mine.length : 0, due: mine.filter((d) => d.due).length };
  }).filter((t) => t.total > 0);
}

/** Questions that are due for another look, most overdue first. Wrong answers come back after a day, right ones after 3, 7, 14 and 30 days. */
export const revisionQueue = (details: QDetail[]): QDetail[] =>
  details.filter((d) => d.due && d.bank === "Practice").sort((a, b) => b.daysOverdue - a.daysOverdue || a.streak - b.streak);

/** Questions where the same wrong option keeps winning. */
export const traps = (details: QDetail[], min = 2): QDetail[] =>
  details.filter((d) => d.trapCount >= min).sort((a, b) => b.trapCount - a.trapCount);

export interface PlanDay {
  date: string; kind: string; hours: number; target: number; answered: number; met: boolean | null;
  tasks: number; ticked: number; linked: number; linkedAnswered: number; mock: string;
}
/** For every plan day up to today: did you reach the question target, tick the tasks, and answer the questions linked to that day. */
export function planAdherence(plan: PlanData, done: Record<string, boolean>, links: Record<string, { q: string[]; mock?: string }>, evs: Ev[], today: string): PlanDay[] {
  const perDay = new Map<string, Ev[]>();
  for (const e of evs) if (e.src === "practice" && e.out !== "skip") { const d = istDay(e.at); (perDay.get(d) ?? perDay.set(d, []).get(d)!).push(e); }
  return plan.days.filter((d) => d.date <= today).map((d) => {
    const got = perDay.get(d.date) ?? [];
    const link = links[d.date];
    const ids = new Set(got.map((e) => e.q));
    return {
      date: d.date, kind: d.kind, hours: d.hours, target: d.targetQs, answered: got.length, met: d.targetQs > 0 ? got.length >= d.targetQs : null,
      tasks: d.tasks.length, ticked: d.tasks.filter((_, i) => done[`${d.date}:${i}`]).length,
      linked: link?.q.length ?? 0, linkedAnswered: (link?.q ?? []).filter((id) => ids.has(id)).length, mock: link?.mock ?? "",
    };
  });
}
export const adherenceSummary = (days: PlanDay[]) => {
  const t = days.filter((d) => d.met !== null), tasks = days.reduce((s, d) => s + d.tasks, 0), ticked = days.reduce((s, d) => s + d.ticked, 0);
  const linked = days.reduce((s, d) => s + d.linked, 0), linkedDone = days.reduce((s, d) => s + d.linkedAnswered, 0);
  return {
    days: days.length, targetDays: t.length, targetMet: t.filter((d) => d.met).length,
    targetRate: t.length ? t.filter((d) => d.met).length / t.length : null,
    taskRate: tasks ? ticked / tasks : null, linkedRate: linked ? linkedDone / linked : null,
  };
};

export interface LinkDay {
  date: string; title: string; kind: string; past: boolean; total: number; answered: number; right: number; wrong: number; left: number; onDay: number; mock: string;
}
/** For every plan day that has linked questions: how many you have answered (at any time), how many are currently right, and how many are still open. */
export function linkProgress(plan: PlanData, links: Record<string, { q: string[]; mock?: string }>, evs: Ev[], today: string): LinkDay[] {
  const latest = new Map<string, "right" | "wrong">(), onDay = new Map<string, Set<string>>();
  for (const e of [...evs].sort((a, b) => a.at - b.at)) {
    if (e.src !== "practice" || e.out === "skip") continue;
    latest.set(e.q, e.out);
    const d = istDay(e.at); (onDay.get(d) ?? onDay.set(d, new Set()).get(d)!).add(e.q);
  }
  const titles = new Map(plan.days.map((d) => [d.date, d]));
  return Object.keys(links).filter((d) => links[d].q.length > 0 || links[d].mock).sort().map((date) => {
    const ids = links[date].q, day = titles.get(date);
    const right = ids.filter((id) => latest.get(id) === "right").length, wrong = ids.filter((id) => latest.get(id) === "wrong").length;
    return {
      date, title: day?.title ?? "", kind: day?.kind ?? "", past: date <= today, total: ids.length, answered: right + wrong, right, wrong, left: ids.length - right - wrong,
      onDay: ids.filter((id) => onDay.get(date)?.has(id)).length, mock: links[date].mock ?? "",
    };
  });
}
export const linkTotals = (rows: LinkDay[]) => {
  const total = rows.reduce((s, r) => s + r.total, 0), right = rows.reduce((s, r) => s + r.right, 0), wrong = rows.reduce((s, r) => s + r.wrong, 0);
  const pastLeft = rows.filter((r) => r.past).reduce((s, r) => s + r.left, 0);
  return { days: rows.length, total, answered: right + wrong, right, wrong, left: total - right - wrong, pastLeft };
};
