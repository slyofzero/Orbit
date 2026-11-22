// The Practice page's small rules (v1), as pure functions: topic rating filters, the filter pop-up's
// choices and how picked choices match questions, the progress bar behind a topic row, which subject is
// open, and the programming list's states. No clock and no database: the `practice.*` queries
// (lib/db/queries/) hand in plain rows.

import type { Difficulty, TopicRating } from "@/types/tables";

/** The Topics tab's status tabs: every topic, or just those with this rating. */
export type StatusFilter = "all" | TopicRating;
/** What the tabs show in the address: `?tab=no_idea` (the same words as the rating). */
export const STATUS_FILTERS = ["all", "no_idea", "shaky", "know"] as const;
export const STATUS_LABEL: Record<TopicRating, string> = { no_idea: "No idea", shaky: "Shaky", know: "Know" };

/** A topic nobody has rated counts as "no idea" (v1: red is new to you). */
export const ratingOf = (rating: TopicRating | null): TopicRating => rating ?? "no_idea";

/** One topic with its question counts (`practice.topics`). Only questions you can practise count (not
 *  code ones, not mock-only ones, not retired ones). */
export interface PracticeTopic {
  id: string;
  name: string;
  subject_id: string;
  subject_name: string;
  rating: TopicRating | null;
  total: number; // practice questions in the topic
  tried: number; // of those, questions with at least one right or wrong answer (skips don't count)
  correct: number; // of those, questions whose latest counted answer is right
}

/** What a question can be filtered by. Practice facets (`practice.topics`) are these, grouped: `n` questions
 *  share exactly this topic, difficulty and set of tags. The programming list uses single questions (n = 1). */
export interface FacetRow {
  topic_id: string;
  subject_id: string;
  difficulty: Difficulty;
  tags: number[]; // tags.id
  n: number;
}

// ---------------------------------------------------------------------------- the progress bar

/** v1's topic row bar: green up to the share of questions whose latest answer was right, red for the share
 *  whose latest answer was wrong, in percent of the row's width. A share that exists is never thinner than
 *  1.5% (so one answer in a big topic still shows); a topic with no answers has no bar. */
export function topicBar(t: Pick<PracticeTopic, "total" | "tried" | "correct">): { good: number; bad: number } {
  if (t.tried === 0 || t.total === 0) return { good: 0, bad: 0 };
  const share = (v: number) => (v > 0 ? Math.max(1.5, Math.min(100, (v / t.total) * 100)) : 0);
  const good = share(t.correct);
  return { good, bad: Math.min(100 - good, share(t.tried - t.correct)) };
}

/** The row's hover text: "12 answered of 30: 9 right, 3 wrong". */
export function topicBarHint(t: Pick<PracticeTopic, "total" | "tried" | "correct">): string {
  return `${t.tried} answered of ${t.total}: ${t.correct} right, ${t.tried - t.correct} wrong`;
}

// ---------------------------------------------------------------------------- finding topics

/** Does a topic pass the status tab and the search box? (The search ignores case and spaces at the ends.) */
export function topicMatches(t: Pick<PracticeTopic, "name" | "rating">, status: StatusFilter, search: string): boolean {
  return (
    (status === "all" || ratingOf(t.rating) === status) && t.name.toLowerCase().includes(search.trim().toLowerCase())
  );
}

/** The topics under their subjects, in the order given (the query sorts them). */
export function groupBySubject<T extends { subject_id: string; subject_name: string }>(
  topics: T[],
): { id: string; name: string; topics: T[] }[] {
  const out: { id: string; name: string; topics: T[] }[] = [];
  for (const t of topics) {
    let g = out[out.length - 1]?.id === t.subject_id ? out[out.length - 1] : out.find((x) => x.id === t.subject_id);
    if (!g) out.push((g = { id: t.subject_id, name: t.subject_name, topics: [] }));
    g.topics.push(t);
  }
  return out;
}

/** Is a subject's section open? While searching or filtering every section is, so matches can't hide.
 *  Otherwise the reader's own choice (`chosen`: subject id → open) wins; before they choose anything, only
 *  the subject of the next planned topic is open (or the first subject when there is no plan). */
export function isSubjectOpen(o: {
  subjectId: string;
  searching: boolean;
  chosen: Record<string, boolean> | null;
  planSubjectId: string | null;
  firstSubjectId: string | null;
}): boolean {
  if (o.searching) return true;
  if (o.chosen) return !!o.chosen[o.subjectId];
  return o.subjectId === (o.planSubjectId ?? o.firstSubjectId);
}

// ---------------------------------------------------------------------------- the filter pop-up

/** The groups of the Filter pop-up, in order. */
export type FilterKind = "difficulty" | "subject" | "topic" | "tag";
export const FILTER_LABEL: Record<FilterKind, string> = {
  difficulty: "Difficulty",
  subject: "Subject",
  topic: "Topic",
  tag: "Misc", // v1's name for the free tags
};
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** A picked choice is `kind:value`, e.g. `subject:sb_1`, `difficulty:hard`, `tag:12`. */
export const filterValue = (kind: FilterKind, id: string | number) => `${kind}:${id}`;

/** Does a question pass what is picked? Within one group any picked choice will do; across groups every
 *  group that has a pick must match. Nothing picked lets everything through. */
export function makeMatcher(
  picked: string[],
): (f: Pick<FacetRow, "topic_id" | "subject_id" | "difficulty" | "tags">) => boolean {
  if (picked.length === 0) return () => true;
  const by: Record<FilterKind, Set<string>> = {
    difficulty: new Set(),
    subject: new Set(),
    topic: new Set(),
    tag: new Set(),
  };
  for (const p of picked) {
    const i = p.indexOf(":");
    by[p.slice(0, i) as FilterKind]?.add(p.slice(i + 1));
  }
  return (f) =>
    (!by.difficulty.size || by.difficulty.has(f.difficulty)) &&
    (!by.subject.size || by.subject.has(f.subject_id)) &&
    (!by.topic.size || by.topic.has(f.topic_id)) &&
    (!by.tag.size || f.tags.some((t) => by.tag.has(String(t))));
}

/** How many questions of a facet list pass the matcher (optionally only those of one topic). */
export function countMatching(facets: FacetRow[], matches: ReturnType<typeof makeMatcher>, topicId?: string): number {
  let n = 0;
  for (const f of facets) if ((topicId === undefined || f.topic_id === topicId) && matches(f)) n += f.n;
  return n;
}

/** What can be picked among these facets, with how many questions each choice has. Difficulty goes easy to
 *  hard, subjects and topics in the order of `subjects` / `topics` (the query's order), tags most common
 *  first. A group with nothing in it is left out. */
export function filterGroups(
  facets: FacetRow[],
  names: {
    subjects: { id: string; name: string }[];
    topics: { id: string; name: string }[];
    tags: { id: number; name: string }[];
  },
): { key: FilterKind; label: string; choices: { value: string; label: string; count: number }[] }[] {
  const tally = <K extends string | number>(of: (f: FacetRow) => K[]) => {
    const m = new Map<K, number>();
    for (const f of facets) for (const k of new Set(of(f))) m.set(k, (m.get(k) ?? 0) + f.n);
    return m;
  };
  const dif = tally((f) => [f.difficulty]);
  const sub = tally((f) => [f.subject_id]);
  const top = tally((f) => [f.topic_id]);
  const tag = tally((f) => f.tags);
  const tagName = new Map(names.tags.map((t) => [t.id, t.name]));
  const groups = [
    {
      key: "difficulty" as const,
      choices: DIFFICULTIES.filter((d) => dif.has(d)).map((d) => ({
        value: filterValue("difficulty", d),
        label: DIFFICULTY_LABEL[d],
        count: dif.get(d)!,
      })),
    },
    {
      key: "subject" as const,
      choices: names.subjects
        .filter((s) => sub.has(s.id))
        .map((s) => ({ value: filterValue("subject", s.id), label: s.name, count: sub.get(s.id)! })),
    },
    {
      key: "topic" as const,
      choices: names.topics
        .filter((t) => top.has(t.id))
        .map((t) => ({ value: filterValue("topic", t.id), label: t.name, count: top.get(t.id)! })),
    },
    {
      key: "tag" as const,
      choices: [...tag.entries()]
        .map(([id, count]) => ({ value: filterValue("tag", id), label: tagName.get(id) ?? String(id), count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    },
  ];
  return groups.filter((g) => g.choices.length > 0).map((g) => ({ ...g, label: FILTER_LABEL[g.key] }));
}

// ---------------------------------------------------------------------------- the programming list

/** Where you are with a code question: solved (latest counted answer right), tried (answered, latest wrong),
 *  or not tried. */
export type CodeState = "solved" | "tried" | "todo";
export const codeState = (latest: "correct" | "incorrect" | null): CodeState =>
  latest === "correct" ? "solved" : latest === "incorrect" ? "tried" : "todo";

export type CodeStatusFilter = "all" | "todo" | "solved";

/** The first line of a question's text for a list row: pictures and code blocks dropped, at most 110 characters. */
export function firstLine(stem: string, max = 110): string {
  const line = stem
    .replace(/!\[[^\]\n]*\]\([^)\s]+\)/g, "")
    .replace(/```[\s\S]*?```/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return "Programming question";
  return line.length > max ? line.slice(0, max).trimEnd() + "…" : line;
}

/** Does a code question pass the status tab (to do = not solved yet) and the search box? The search looks in
 *  the text, the topic name and the tag names. */
export function codeMatches(
  q: { stem: string; topic_name: string; state: CodeState; tagNames: string[] },
  status: CodeStatusFilter,
  search: string,
): boolean {
  if (status === "solved" && q.state !== "solved") return false;
  if (status === "todo" && q.state === "solved") return false;
  const n = search.trim().toLowerCase();
  return (
    !n ||
    q.stem.toLowerCase().includes(n) ||
    q.topic_name.toLowerCase().includes(n) ||
    q.tagNames.some((t) => t.toLowerCase().includes(n))
  );
}

// ---------------------------------------------------------------------------- what the queries return

/** `practice.counts`: what is loaded, which decides whether a tab shows its list or "no questions yet". */
export interface PracticeCounts {
  practice: number; // topic-practice questions (not code, not mock-only)
  programming: number; // code questions
  mocks: number; // full-length mocks
  mockQuestions: number; // questions that belong to mocks only
}

/** `practice.topics`: the Topics tab. */
export interface PracticeTopicsData {
  topics: PracticeTopic[];
  facets: FacetRow[];
  tags: { id: number; name: string }[];
  /** The next plan day (today or later) that has linked questions, with its topics. */
  next: { on_date: string; title: string | null; topics: { id: string; name: string; subject_id: string }[] } | null;
}

/** One code question in the Programming tab (`practice.programming`). */
export interface PracticeCode {
  id: string;
  stem: string; // the first 600 characters
  marks: number;
  difficulty: Difficulty;
  topic_id: string;
  topic_name: string;
  subject_id: string;
  subject_name: string;
  tags: number[];
  state: CodeState;
}
export interface PracticeCodeData {
  questions: PracticeCode[];
  tags: { id: number; name: string }[];
}

/** One full-length mock (`practice.mocks`). */
export interface MockCard {
  id: string;
  name: string;
  instructions: string | null;
  minutes: number;
  full_screen: number; // 1 = runs in full screen (raw 0 / 1 from SQL)
  questions: number;
  marks: number;
  attempts: number; // submitted ones
  best: number | null; // best score among them
}
/** One row of the mock history: every attempt, newest first. */
export interface MockHistoryRow {
  id: string;
  name: string;
  status: "in_progress" | "submitted" | "abandoned" | "failed";
  started_at: number;
  score: number | null;
  max_score: number | null;
  questions: number;
}
export interface PracticeMocksData {
  mocks: MockCard[];
  history: MockHistoryRow[];
  /** Topics that have practice questions (for the subject / topic / weak-topics tests). */
  topics: { id: string; name: string; subject_id: string; subject_name: string; rating: TopicRating | null }[];
  practiceQuestions: number;
}

// ---------------------------------------------------------------------------- the page's tabs

/** The three sections of /practice, kept in the address as `?tab=`. */
export const PRACTICE_TABS = ["topics", "programming", "mocks"] as const;
export type PracticeTab = (typeof PRACTICE_TABS)[number];

/** Has a tab nothing to show yet (so it shows "how to load some" instead)? Topics needs practice questions,
 *  Programming needs code questions, Mocks needs a full-length mock or mock-only questions. */
export function tabEmpty(tab: PracticeTab, c: PracticeCounts): boolean {
  if (tab === "topics") return c.practice === 0;
  if (tab === "programming") return c.programming === 0;
  return c.mocks === 0 && c.mockQuestions === 0;
}
