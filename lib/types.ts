export type QType = "mcq" | "msq" | "nat" | "str" | "code";

/** A programming question: you write a program, the app runs it on the tests (stdin in, stdout out). */
export interface CodeSpec {
  language: string; // python, c, cpp, java or javascript
  starter?: string; // code the editor starts with
  solution?: string; // a reference solution, shown after you submit or skip
  tests: { input: string; output: string; hidden?: boolean }[]; // hidden tests only show pass or fail
  timeLimitMs?: number; // per test, default 3000
  setup?: string; // what must exist on the learner's computer first (files, folders, a database). Shown on the card, and used to write the "Copy setup prompt" for an AI
}

export interface Question {
  id: string;
  topic: string; // topic id (mandatory tag): which topic this question tests
  subject?: string; // subject id (mandatory tag, always the subject of the topic): filled in when a pack is loaded
  difficulty?: Difficulty; // mandatory in uploaded packs; optional here so older saved packs still load
  tags?: string[]; // optional extra tags, e.g. "formula", "trap"
  type: QType;
  marks: 1 | 2;
  text: string; // supports $math$, $$math$$ and ``` code blocks
  options?: string[];
  // mcq: index, msq: array of indices, nat: {value, tol}, str: string or list of strings
  // str: the accepted text, or a list of accepted texts (see lib/strMatch.ts)
  answer: number | number[] | { value: number; tol: number } | string | string[];
  match?: "exact" | "list" | "set"; // only for type "str": how the typed text is compared (default "exact")
  caseSensitive?: boolean; // only for type "str": default false
  explanation: string;
  code?: CodeSpec; // only for type "code"; `answer` is not used then
}

export type Answer = number | number[] | string; // nat and str answers are typed as strings

export interface Resp {
  ans?: Answer;
  visited: boolean;
  marked: boolean;
}

export interface Section {
  name: string;
  from: number; // inclusive index
  to: number; // inclusive index
}

export interface Attempt {
  id: string;
  title: string;
  createdAt: number;
  startedAt?: number;
  submittedAt?: number;
  durationSec: number;
  questions: Question[];
  sections: Section[];
  responses: Record<number, Resp>;
  warnings: string[];
  /** Set when the test was ended for leaving the exam screen. Such attempts are not scored. */
  failed?: string;
}

export interface Settings {
  name: string;
  examDate: string; // YYYY-MM-DD
}

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export interface PracticeRec {
  correct: boolean;
  at: number;
  topic: string;
}

/** One answered or skipped question in Practice, kept so statistics can count every encounter, not just the latest. */
export interface LogEntry {
  q: string;
  topic: string;
  subject: string;
  tags?: string[];
  type: QType;
  marks: 1 | 2;
  out: "right" | "wrong" | "skip";
  at: number;
  ms?: number; // seconds on the question, in milliseconds
  pick?: number | number[]; // the option(s) chosen, for MCQ and MSQ, so wrong picks that keep repeating can be found
}

export type TopicStatus = "know" | "shaky" | "noidea";

export interface Topic {
  id: string;
  name: string;
  subject: string;
  status: TopicStatus;
}

export type DayKind = "study" | "light" | "mock" | "crunch" | "buffer" | "exam" | "taper";

export interface Day {
  date: string; // YYYY-MM-DD
  phase: string; // phase id, see PlanData.phaseNames
  kind: DayKind;
  hours: number;
  title: string;
  topics: string[]; // topic ids to practise
  tasks: string[];
  targetQs: number; // practice questions to answer today
}
