// The Stats page's rules, as pure functions (docs/STATS.md): topic strength (§3), streaks and mastery (§4),
// the daily activity bars, and how times and percentages are written. No database: lib/db/queries/stats.ts
// hands these the rows it reads.

import { addDays, type IsoDate } from "@/lib/dates";
import type { Difficulty } from "@/types/tables";

/** docs/STATS.md §3: tunable constants. */
export const HALF_LIFE_DAYS = 14;
export const SMOOTHING_K = 5;
export const STRONG_COVERAGE = 0.2;
export const MASTERED_STREAK = 3;
/** Rows a page of the Questions tab shows. */
export const STATS_PAGE = 25;

const DAY_MS = 86_400_000;
const WEIGHT: Record<Difficulty, { correct: number; incorrect: number }> = {
  easy: { correct: 0.8, incorrect: 1.3 },
  medium: { correct: 1, incorrect: 1 },
  hard: { correct: 1.3, incorrect: 0.8 },
};

/** One counted answer (correct or incorrect; skips never count towards accuracy or strength). */
export interface CountedAnswer {
  question_id: string;
  group: string; // the topic (or subject) it counts towards
  difficulty: Difficulty;
  outcome: "correct" | "incorrect";
  recorded_at: number;
}

/** An answer's weight: recency × difficulty (§3 step 1). Answers from the future count as new. */
export function answerWeight(a: Pick<CountedAnswer, "difficulty" | "outcome" | "recorded_at">, now: number): number {
  const age = Math.max(0, now - a.recorded_at) / DAY_MS;
  return 0.5 ** (age / HALF_LIFE_DAYS) * (WEIGHT[a.difficulty] ?? WEIGHT.medium)[a.outcome];
}

/** Strength per group (§3 steps 2–3): weighted accuracy smoothed towards the overall level, 0–1.
 *  `overall` is null when nothing has been answered; a group with no answers is left out. */
export function strengths(answers: CountedAnswer[], now: number): { overall: number | null; by: Map<string, number> } {
  const sums = new Map<string, { right: number; all: number }>();
  let right = 0;
  let all = 0;
  for (const a of answers) {
    const w = answerWeight(a, now);
    const s = sums.get(a.group) ?? { right: 0, all: 0 };
    s.all += w;
    all += w;
    if (a.outcome === "correct") {
      s.right += w;
      right += w;
    }
    sums.set(a.group, s);
  }
  if (all === 0) return { overall: null, by: new Map() };
  const p = right / all;
  const by = new Map<string, number>();
  for (const [g, s] of sums) by.set(g, (s.right + SMOOTHING_K * p) / (s.all + SMOOTHING_K));
  return { overall: p, by };
}

/** Correct answers in a row, counting back from the latest. `outcomes` newest first, skips already left out. */
export function streakOf(outcomes: readonly ("correct" | "incorrect")[]): number {
  let n = 0;
  while (n < outcomes.length && outcomes[n] === "correct") n++;
  return n;
}

/** Per question: its streak, from counted answers in any order. */
export function streaks(
  answers: Pick<CountedAnswer, "question_id" | "outcome" | "recorded_at">[],
): Map<string, number> {
  const byQ = new Map<string, { at: number; outcome: "correct" | "incorrect" }[]>();
  for (const a of answers) {
    const list = byQ.get(a.question_id) ?? [];
    list.push({ at: a.recorded_at, outcome: a.outcome });
    byQ.set(a.question_id, list);
  }
  const out = new Map<string, number>();
  for (const [q, list] of byQ) {
    list.sort((x, y) => y.at - x.at);
    out.set(q, streakOf(list.map((x) => x.outcome)));
  }
  return out;
}

/** A topic (or subject) as the strongest / weakest lists need it. */
export interface Ranked {
  id: string;
  strength: number | null; // null = not started
  answered: number; // counted answers
  coverage: number; // 0–1: share of its questions with a counted answer
}

/** §3 ranking: weakest = lowest strength among started ones; strongest = highest among those with coverage
 *  ≥ 20%. A topic is never in both lists (weakest wins when there are few). Up to `n` each. */
export function rankStrength<T extends Ranked>(items: T[], n = 3): { strongest: T[]; weakest: T[] } {
  const started = items.filter((t) => t.strength !== null && t.answered > 0);
  const weakest = [...started].sort((a, b) => a.strength! - b.strength! || b.answered - a.answered).slice(0, n);
  const taken = new Set(weakest.map((t) => t.id));
  const strongest = started
    .filter((t) => t.coverage >= STRONG_COVERAGE && !taken.has(t.id))
    .sort((a, b) => b.strength! - a.strength! || b.answered - a.answered)
    .slice(0, n);
  return { strongest, weakest };
}

export interface DayActivity {
  day: IsoDate;
  answered: number; // correct + incorrect
  correct: number;
  time_ms: number; // skips included
}

/** The last `n` IST days ending `today`, oldest first; days with no rows are zeros. */
export function fillDays(rows: DayActivity[], today: IsoDate, n: number): DayActivity[] {
  const by = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - (n - 1));
    return by.get(day) ?? { day, answered: 0, correct: 0, time_ms: 0 };
  });
}

/** The answer counts shared by a subject, a topic and a question row. */
export interface AnswerCounts {
  shown: number; // sittings it was shown in (every question_answers row)
  correct: number;
  incorrect: number;
  skipped: number;
  time_ms: number; // all active time, skips included
  answered_ms: number; // time of counted answers only (for the average per answer)
  last_at: number | null; // latest answer or skip
}

export interface StatsGroup extends AnswerCounts {
  id: string;
  name: string;
  total: number; // live practice questions (code included; mock-only ones are not)
  tried: number; // of those, the ones with a counted answer (= q_right + q_wrong)
  // the same questions by their LATEST counted answer; the rest (total − these three) were never shown
  q_right: number;
  q_wrong: number;
  q_skipped: number; // shown, never answered
  strength: number | null; // 0–1, null = not started
}
export interface StatsTopic extends StatsGroup {
  subject_id: string;
  subject_name: string;
  practice: number; // live questions the topic practice screen shows (no code, no mock-only)
}
export type StatsSubject = StatsGroup;

export interface StatsSummary {
  totals: AnswerCounts & { mock_answers: number; total: number; tried: number; mastered: number; mistakes: number };
  overall: number | null; // overall weighted accuracy, 0–1
  days: DayActivity[]; // the last 14 IST days, oldest first
  subjects: StatsSubject[];
  topics: StatsTopic[];
  strongest: StatsTopic[];
  weakest: StatsTopic[];
}

export type QuestionSort = "recent" | "time" | "wrong" | "accuracy" | "shown";
export type QuestionShow = "all" | "mistakes";

export interface StatsQuestion extends AnswerCounts {
  id: string;
  type: string;
  pool: string;
  stem: string; // the first 600 characters
  topic_name: string;
  subject_name: string;
  latest: "correct" | "incorrect" | null; // the latest counted answer
}

/** One row of a question's history: one sitting it was shown in. */
export interface HistoryEntry {
  id: number;
  recorded_at: number;
  outcome: "correct" | "incorrect" | "skipped";
  time_ms: number;
  attempt_id: string | null; // null = practice
  mock_name: string | null; // the mock it came from
}
export interface QuestionHistory {
  question: StatsQuestion | null; // null = no such question
  entries: HistoryEntry[]; // newest first
  streak: number; // right answers in a row, from the latest
}

/** Adds `b`'s counts into `a` (subjects are the sum of their topics). */
export function addCounts<T extends AnswerCounts>(a: T, b: AnswerCounts): T {
  a.shown += b.shown;
  a.correct += b.correct;
  a.incorrect += b.incorrect;
  a.skipped += b.skipped;
  a.time_ms += b.time_ms;
  a.answered_ms += b.answered_ms;
  a.last_at = b.last_at === null ? a.last_at : Math.max(a.last_at ?? 0, b.last_at);
  return a;
}

/** Mean time of a counted answer, or null when there are none. */
export const avgTime = (c: AnswerCounts) =>
  c.correct + c.incorrect ? c.answered_ms / (c.correct + c.incorrect) : null;

type Breakdown = Pick<StatsGroup, "total" | "q_right" | "q_wrong" | "q_skipped">;

/** A subject / topic row's fill (ProgressRow), in percent of its questions, each by its latest answer: right
 *  (green), wrong (red), opened but never answered (grey); the rest of the row = never seen. */
export function shares(g: Breakdown): { good: number; bad: number; skipped: number } {
  if (!g.total) return { good: 0, bad: 0, skipped: 0 };
  const pct = (n: number) => (n / g.total) * 100;
  return { good: pct(g.q_right), bad: pct(g.q_wrong), skipped: pct(g.q_skipped) };
}

/** The hover text of a subject / topic row: its questions by latest answer, then time. */
export const countsHint = (g: Breakdown & Pick<AnswerCounts, "time_ms">) => {
  const unseen = Math.max(0, g.total - g.q_right - g.q_wrong - g.q_skipped);
  return `${g.total} questions: ${g.q_right} right, ${g.q_wrong} wrong, ${g.q_skipped} opened and left, ${unseen} not seen · ${formatDuration(g.time_ms)} spent`;
};

/** Strength (0–1) as "64%", or "not started". */
export const strengthText = (s: number | null) => (s === null ? "not started" : formatPct(s * 100));

/** A topic's practice screen, or undefined when it has nothing to practise there (only code / mock questions). */
export const topicHref = (t: Pick<StatsTopic, "id" | "practice">) =>
  t.practice > 0 ? `/practice/session?topic=${encodeURIComponent(t.id)}` : undefined;

/** Where a Questions-tab row opens (as Manage pack does): practice screen, Programming screen, or for a
 *  mock-only question its editor (answering it in practice would mix mock questions into practice stats). */
export const questionHref = (q: Pick<StatsQuestion, "id" | "type" | "pool">) =>
  q.pool === "mock"
    ? `/practice/manage?q=${encodeURIComponent(q.id)}`
    : q.type === "code"
      ? `/practice/code?id=${encodeURIComponent(q.id)}`
      : `/practice/session?q=${encodeURIComponent(q.id)}`;

/** A question's history page (app/(app)/stats/question/page.tsx). */
export const historyHref = (id: string) => `/stats/question?id=${encodeURIComponent(id)}`;

/** Percent right of counted answers, rounded; null when nothing was answered. */
export function accuracy(correct: number, incorrect: number): number | null {
  const n = correct + incorrect;
  return n ? Math.round((correct / n) * 100) : null;
}

/** "—", "45s", "3m 20s", "2h 5m". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

/** IST clock time of a moment, "14:05". */
export const istClock = (ms: number) => new Date(ms + 330 * 60_000).toISOString().slice(11, 16);

/** "72%", or "—" for null. */
export const formatPct = (p: number | null | undefined) => (p == null ? "—" : `${Math.round(p)}%`);
