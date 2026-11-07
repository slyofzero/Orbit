// Statistics from everything you have answered. Pure functions, tested by scripts/check.ts.
// Every question carries two mandatory tags (its subject and its topic) and optional tags; all numbers are cut along those tags.
import { Attempt, LogEntry, PracticeRec, QType, Question } from "./types";
import { PackData } from "./packs";
import { isAttempted, isCorrect, marksFor } from "./scoring";

export type Out = "right" | "wrong" | "skip";
export interface Ev {
  q: string; topic: string; subject: string; tags: string[]; type: QType; marks: 1 | 2;
  out: Out; at: number; ms?: number; src: "practice" | "mock"; got?: number; mock?: string;
}

const day = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Every encounter with a question: practice answers and skips, plus every question of every finished (not failed) mock. */
export function buildEvents(input: {
  log: LogEntry[]; practice: Record<string, PracticeRec>; attempts: Attempt[]; pack: PackData; find: (id: string) => Question | undefined;
}): Ev[] {
  const { log, practice, attempts, pack, find } = input;
  const subjectOf = (topic: string, q?: Question) => q?.subject ?? pack.topics.find((t) => t.id === topic)?.subject ?? "other";
  const evs: Ev[] = [];
  const logged = new Set<string>();
  for (const e of log) {
    logged.add(e.q);
    evs.push({ q: e.q, topic: e.topic, subject: e.subject, tags: e.tags ?? [], type: e.type, marks: e.marks, out: e.out, at: e.at, ms: e.ms, src: "practice" });
  }
  // answers saved before the log existed: one encounter each, from the latest result
  for (const [id, rec] of Object.entries(practice)) {
    if (logged.has(id)) continue;
    const q = find(id);
    evs.push({ q: id, topic: rec.topic, subject: subjectOf(rec.topic, q), tags: q?.tags ?? [], type: q?.type ?? "mcq", marks: q?.marks ?? 1, out: rec.correct ? "right" : "wrong", at: rec.at, src: "practice" });
  }
  for (const a of attempts) {
    if (!a.submittedAt || a.failed) continue;
    a.questions.forEach((q, i) => {
      const ans = a.responses[i]?.ans;
      const out: Out = !isAttempted(ans) ? "skip" : isCorrect(q, ans) ? "right" : "wrong";
      evs.push({ q: q.id, topic: q.topic, subject: subjectOf(q.topic, q), tags: q.tags ?? [], type: q.type, marks: q.marks, out, at: a.submittedAt!, src: "mock", got: marksFor(q, ans), mock: a.id });
    });
  }
  return evs.sort((a, b) => a.at - b.at);
}

export interface Filters { days: number | null; src: "all" | "practice" | "mock"; type: "all" | QType; tag: string | null }
export const NO_FILTER: Filters = { days: null, src: "all", type: "all", tag: null };

export function applyFilters(evs: Ev[], f: Filters, now = Date.now()): Ev[] {
  const since = f.days ? now - f.days * 86_400_000 : 0;
  return evs.filter((e) => e.at >= since && (f.src === "all" || e.src === f.src) && (f.type === "all" || e.type === f.type) && (!f.tag || e.tags.includes(f.tag)));
}

export interface M {
  n: number; right: number; wrong: number; skip: number;
  answered: number;
  acc: number | null;     // right / (right + wrong); null when nothing was answered
  strength: number;       // accuracy pulled toward 50% for small samples, so 1/1 does not beat 40/50. Use this to rank.
  skipRate: number;       // skips / encounters
  avgMs: number | null;   // practice only
  unique: number;         // different questions seen
  total: number;          // questions in the pack for this tag
  coverage: number;       // unique / total, 0..1
  last: number | null;    // time of the latest encounter
  trend: number | null;   // accuracy in the last 14 days minus the 14 days before (null when too few answers)
}

export function metrics(evs: Ev[], total = 0, now = Date.now()): M {
  let right = 0, wrong = 0, skip = 0, ms = 0, msN = 0, last: number | null = null;
  const seen = new Set<string>();
  const rec = { r: 0, w: 0 }, prev = { r: 0, w: 0 };
  for (const e of evs) {
    if (e.out === "right") right++; else if (e.out === "wrong") wrong++; else skip++;
    if (e.ms !== undefined && e.out !== "skip") { ms += e.ms; msN++; }
    seen.add(e.q);
    if (last === null || e.at > last) last = e.at;
    const age = (now - e.at) / 86_400_000;
    if (e.out !== "skip") { const b = age <= 14 ? rec : age <= 28 ? prev : null; if (b) { if (e.out === "right") b.r++; else b.w++; } }
  }
  const answered = right + wrong;
  const ra = rec.r + rec.w, pa = prev.r + prev.w;
  return {
    n: evs.length, right, wrong, skip, answered,
    acc: answered ? right / answered : null,
    strength: (right + 2) / (answered + 4),
    skipRate: evs.length ? skip / evs.length : 0,
    avgMs: msN ? ms / msN : null,
    unique: seen.size, total,
    coverage: total ? Math.min(1, seen.size / total) : 0,
    last,
    trend: ra >= 3 && pa >= 3 ? rec.r / ra - prev.r / pa : null,
  };
}

export interface Node { id: string; name: string; m: M; kind: "subject" | "topic" | "question"; parent?: string; status?: string }

/** Every question in the pack, from the practice bank and from every mock test. `mock` is the mock's name for mock questions. */
export function bankQuestions(pack: PackData): (Question & { mock?: string })[] {
  return [...pack.questions, ...(pack.mockTests ?? []).flatMap((m) => m.sections.flatMap((x) => x.questions.map((q) => ({ ...q, mock: m.name }))))];
}

/** Subjects, topics and questions with their numbers, for the given (already filtered) events. */
export function breakdown(evs: Ev[], pack: PackData, now = Date.now()) {
  const totals = { subject: {} as Record<string, number>, topic: {} as Record<string, number> };
  for (const q of bankQuestions(pack)) {
    const s = q.subject ?? pack.topics.find((t) => t.id === q.topic)?.subject ?? "other";
    totals.subject[s] = (totals.subject[s] ?? 0) + 1;
    totals.topic[q.topic] = (totals.topic[q.topic] ?? 0) + 1;
  }
  const by = <K extends string>(key: (e: Ev) => K) => { const m = new Map<K, Ev[]>(); for (const e of evs) { const k = key(e); (m.get(k) ?? m.set(k, []).get(k)!).push(e); } return m; };
  const bySub = by((e) => e.subject), byTopic = by((e) => e.topic), byQ = by((e) => e.q);

  const subjectIds = [...new Set([...Object.keys(pack.subjects), ...bySub.keys()])];
  const subjects: Node[] = subjectIds.map((id) => ({ id, name: pack.subjects[id] ?? (id === "other" ? "Other" : id), kind: "subject" as const, m: metrics(bySub.get(id) ?? [], totals.subject[id] ?? 0, now) }));

  const topicIds = [...new Set([...pack.topics.map((t) => t.id), ...byTopic.keys()])];
  const topics: Node[] = topicIds.map((id) => {
    const t = pack.topics.find((x) => x.id === id);
    const subj = t?.subject ?? byTopic.get(id)?.[0]?.subject ?? "other";
    return { id, name: t?.name ?? id, kind: "topic" as const, parent: subj, status: t?.status, m: metrics(byTopic.get(id) ?? [], totals.topic[id] ?? 0, now) };
  });

  const everyQ = bankQuestions(pack);
  const qIds = new Set<string>([...everyQ.map((q) => q.id), ...byQ.keys()]);
  const packQ = new Map(everyQ.map((q) => [q.id, q]));
  const questions: (Node & { q?: Question; tags: string[]; mock?: string })[] = [...qIds].map((id) => {
    const evq = byQ.get(id) ?? [];
    const q = packQ.get(id);
    return { id, name: q?.text ?? id, kind: "question" as const, parent: q?.topic ?? evq[0]?.topic, q, mock: q?.mock, tags: q?.tags ?? evq[0]?.tags ?? [], m: metrics(evq, 1, now) };
  });
  return { subjects, topics, questions };
}

export interface Ranked { best: Node | null; worst: Node | null; enough: Node[] }
/** Strongest and weakest by the small-sample-safe strength score. Needs at least `min` answered questions to take part. */
export function rank(nodes: Node[], min = 5): Ranked {
  const enough = nodes.filter((n) => n.m.answered >= min).sort((a, b) => b.m.strength - a.m.strength);
  return { best: enough[0] ?? null, worst: enough.length > 1 ? enough[enough.length - 1] : null, enough };
}

export interface TagStat { tag: string; m: M }
export function tagStats(evs: Ev[], pack: PackData, now = Date.now()): TagStat[] {
  const m = new Map<string, Ev[]>();
  for (const e of evs) for (const t of e.tags) (m.get(t) ?? m.set(t, []).get(t)!).push(e);
  const total = new Map<string, number>();
  for (const q of bankQuestions(pack)) for (const t of q.tags ?? []) total.set(t, (total.get(t) ?? 0) + 1);
  return [...m.entries()].map(([tag, list]) => ({ tag, m: metrics(list, total.get(tag) ?? 0, now) })).sort((a, b) => b.m.n - a.m.n);
}
export const allTags = (pack: PackData): string[] => [...new Set(bankQuestions(pack).flatMap((q) => q.tags ?? []))].sort();

/** Days with activity, current streak and best streak. */
export function activity(evs: Ev[], now = Date.now()) {
  const per = new Map<string, { n: number; right: number }>();
  for (const e of evs) { const d = day(e.at); const v = per.get(d) ?? { n: 0, right: 0 }; v.n++; if (e.out === "right") v.right++; per.set(d, v); }
  const has = (d: string) => per.has(d);
  const shift = (d: string, k: number) => new Date(Date.parse(d + "T00:00:00Z") + k * 86_400_000).toISOString().slice(0, 10);
  const today = day(now);
  let cur = 0; let d = has(today) ? today : shift(today, -1);
  while (has(d)) { cur++; d = shift(d, -1); }
  let best = 0, run = 0, prev = "";
  for (const k of [...per.keys()].sort()) { run = prev && shift(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; }
  return { per, current: cur, best, activeDays: per.size, today };
}

/** Mock results, oldest first (failed mocks are left out). */
export function mockScores(attempts: Attempt[]) {
  return attempts.filter((a) => a.submittedAt && !a.failed).sort((a, b) => a.submittedAt! - b.submittedAt!).map((a) => {
    const got = a.questions.reduce((s, q, i) => s + marksFor(q, a.responses[i]?.ans), 0);
    const max = a.questions.reduce((s, q) => s + q.marks, 0);
    return { id: a.id, title: a.title, at: a.submittedAt!, got, max, pct: max ? got / max : 0 };
  });
}

const pct = (x: number | null) => (x === null ? "n/a" : `${Math.round(x * 100)}%`);
/** Plain-language findings, most useful first. */
export function insights(evs: Ev[], b: ReturnType<typeof breakdown>, now = Date.now()): string[] {
  const out: string[] = [];
  if (!evs.length) return ["Answer a few questions in Practice or take a mock, and findings about your strengths and gaps appear here."];
  const subs = rank(b.subjects, 5);
  if (subs.best && subs.worst) out.push(`Strongest subject: ${subs.best.name} (${pct(subs.best.m.acc)} right). Weakest: ${subs.worst.name} (${pct(subs.worst.m.acc)}).`);
  const tops = rank(b.topics, 4);
  if (tops.worst) out.push(`Weakest topic: ${tops.worst.name} at ${pct(tops.worst.m.acc)} over ${tops.worst.m.answered} answers. Start your next session there.`);
  if (tops.best && tops.best !== tops.worst) out.push(`Strongest topic: ${tops.best.name} at ${pct(tops.best.m.acc)}. Keep it warm with a few questions a week.`);
  for (const t of b.topics.filter((t) => t.status === "know" && t.m.answered >= 4 && (t.m.acc ?? 1) < 0.6).slice(0, 2)) out.push(`You marked ${t.name} as "know", but you get only ${pct(t.m.acc)} right. Consider moving it to "shaky".`);
  for (const t of b.topics.filter((t) => t.status === "noidea" && t.m.answered >= 4 && (t.m.acc ?? 0) >= 0.75).slice(0, 2)) out.push(`You marked ${t.name} as "no idea", yet you get ${pct(t.m.acc)} right. It may deserve a better status.`);
  const skippy = b.topics.filter((t) => t.m.n >= 5 && t.m.skipRate >= 0.3).sort((a, b) => b.m.skipRate - a.m.skipRate)[0];
  if (skippy) out.push(`You skip ${pct(skippy.m.skipRate)} of the ${skippy.name} questions you meet. Skipping hides weakness; try them untimed first.`);
  const stale = b.topics.filter((t) => t.m.last !== null && (now - t.m.last!) / 86_400_000 >= 14 && t.m.n >= 3).sort((a, b) => a.m.last! - b.m.last!)[0];
  if (stale) out.push(`You have not touched ${stale.name} for ${Math.floor((now - stale.m.last!) / 86_400_000)} days. Revise it before it fades.`);
  const untouched = b.topics.filter((t) => t.m.n === 0 && t.m.total > 0);
  if (untouched.length) out.push(`${untouched.length} topic${untouched.length === 1 ? "" : "s"} with questions you have never opened, e.g. ${untouched.slice(0, 3).map((t) => t.name).join(", ")}.`);
  const up = [...b.topics].filter((t) => t.m.trend !== null).sort((a, b) => b.m.trend! - a.m.trend!);
  if (up[0] && up[0].m.trend! >= 0.1) out.push(`Biggest improvement: ${up[0].name}, up ${Math.round(up[0].m.trend! * 100)} points over the last two weeks.`);
  const down = up[up.length - 1];
  if (down && down.m.trend! <= -0.1) out.push(`Slipping: ${down.name} dropped ${Math.round(-down.m.trend! * 100)} points over the last two weeks.`);
  const hard = b.questions.filter((q) => q.m.answered >= 2 && q.m.acc === 0).length;
  if (hard) out.push(`${hard} question${hard === 1 ? "" : "s"} you have answered wrong every single time. They are in Questions > Always wrong.`);
  // time of day
  const hours = new Map<number, { r: number; n: number }>();
  for (const e of evs) if (e.out !== "skip") { const h = Math.floor(Number(new Date(e.at).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).slice(0, 2)) / 6); const v = hours.get(h) ?? { r: 0, n: 0 }; v.n++; if (e.out === "right") v.r++; hours.set(h, v); }
  const parts = [...hours.entries()].filter(([, v]) => v.n >= 10).sort((a, b) => b[1].r / b[1].n - a[1].r / a[1].n);
  if (parts.length >= 2) { const name = ["late night (12am to 6am)", "morning (6am to 12pm)", "afternoon (12pm to 6pm)", "evening (6pm to 12am)"]; out.push(`You score best in the ${name[parts[0][0]]}: ${pct(parts[0][1].r / parts[0][1].n)} right, against ${pct(parts[parts.length - 1][1].r / parts[parts.length - 1][1].n)} in the ${name[parts[parts.length - 1][0]]}.`); }
  return out;
}

export const fmtMs = (ms: number | null) => (ms === null ? "n/a" : ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`);
export const fmtPct = pct;
