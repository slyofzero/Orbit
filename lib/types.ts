export type QType = "mcq" | "msq" | "nat";

export interface Question {
  id: string;
  topic: string; // topic id (mandatory tag): which topic this question tests
  subject?: string; // subject id (mandatory tag, always the subject of the topic): filled in when a pack is loaded
  tags?: string[]; // optional extra tags, e.g. "formula", "trap", "hard"
  type: QType;
  marks: 1 | 2;
  text: string; // supports $math$, $$math$$ and ``` code blocks
  options?: string[];
  // mcq: index, msq: array of indices, nat: {value, tol}
  answer: number | number[] | { value: number; tol: number };
  explanation: string;
}

export type Answer = number | number[] | string; // nat answers are typed as strings

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
