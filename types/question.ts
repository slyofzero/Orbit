// How a question is shaped in the app, and where each part is stored.
//
// Storage: SQLite (WASM) inside the DB worker, one file per profile in OPFS
// (`orbit-<profileId>.sqlite3`). See docs/STORAGE.md and db/schema.sql.
// The UI never reads tables directly; the worker turns rows into these objects.
//
// Conventions (same as the schema):
//   * IDs are opaque strings. They never encode a topic, subject or position.
//   * Times are Unix milliseconds (UTC). SQLite stores booleans as 0/1; here they are booleans.
//   * Text fields hold markdown + $LaTeX$; pictures are written as ![alt](img:<hash>).

/** `q_…`, stored in `questions.id`. */
export type QuestionId = string;
/** `tp_…`, stored in `topics.id`. */
export type TopicId = string;
/** Short readable code (`prob`, `la`, …), stored in `subjects.id`. */
export type SubjectId = string;
/** Imported pack, stored in `packs.id`. */
export type PackId = string;
/** SHA-256 based name of a picture (`h…`), stored in `images.hash`. */
export type ImageHash = string;
/** Stable ID of one MCQ/MSQ choice, stored in `question_options.id`. Answers point at this, never at a letter. */
export type OptionId = number;

export type QuestionType = "mcq" | "msq" | "nat" | "str" | "code";
export type Difficulty = "easy" | "medium" | "hard";
export type Marks = 1 | 2;
/** `practice` = shown in practice; `mock` = only appears inside mock tests. */
export type QuestionPool = "practice" | "mock";

/** Fields every question has. Table: `questions`. */
interface QuestionBase {
  id: QuestionId;
  topicId: TopicId;              // questions.topic_id  → topics(id)
  packId: PackId | null;         // questions.pack_id   → packs(id); null = added by hand
  pool: QuestionPool;            // questions.pool
  marks: Marks;                  // questions.marks
  difficulty: Difficulty;        // questions.difficulty
  stem: string;                  // questions.stem         (also indexed for search in questions_fts)
  explanation: string;           // questions.explanation  ('' when none; also in questions_fts)
  tags: string[];                // question_tags → tags.name
  images: ImageHash[];           // question_images (derived on save by scanning stem, options, explanation)
  contentHash: string;           // questions.content_hash: finds true duplicates
  rev: number;                   // questions.rev: +1 on every edit; old versions → question_history
  legacyId: string | null;       // questions.legacy_id: v2 ID (e.g. "t20-4"), never shown in the UI
  createdAt: number;             // questions.created_at
  updatedAt: number;             // questions.updated_at
  retiredAt: number | null;      // questions.retired_at: set = hidden, kept for history (never hard-deleted)
}

/** One MCQ/MSQ choice. Table: `question_options`. Edited in place so recorded picks stay valid. */
export interface QuestionOption {
  id: OptionId;                  // question_options.id
  position: number;              // question_options.position: 0 = A, 1 = B, …
  body: string;                  // question_options.body
  isCorrect: boolean;            // question_options.is_correct
}

/** Single correct choice. */
export interface McqQuestion extends QuestionBase {
  type: "mcq";
  options: QuestionOption[];     // exactly one isCorrect
}

/** One or more correct choices. */
export interface MsqQuestion extends QuestionBase {
  type: "msq";
  options: QuestionOption[];     // at least one isCorrect
}

/** Numerical answer. Columns on `questions`. */
export interface NatQuestion extends QuestionBase {
  type: "nat";
  value: number;                 // questions.nat_value
  tolerance: number;             // questions.nat_tol (>= 0; 0 = exact)
}

/** How a typed text answer is compared. */
export type StrMatch =
  | "exact"   // whole string
  | "list"    // comma-separated items, order matters
  | "set";    // comma-separated items, order ignored

/** Typed text answer. Rules on `questions`, accepted answers in `question_text_answers`. */
export interface StrQuestion extends QuestionBase {
  type: "str";
  match: StrMatch;               // questions.str_match
  caseSensitive: boolean;        // questions.str_case_sensitive
  accepted: string[];            // question_text_answers.value, in position order (any one is right)
}

export type CodeLanguage = "python" | "c" | "cpp" | "java" | "javascript";

/** One test case for a code question. Table: `code_tests`. */
export interface CodeTest {
  position: number;              // code_tests.position
  input: string;                 // code_tests.input
  expected: string;              // code_tests.expected
  hidden: boolean;               // code_tests.hidden: not shown to the learner
}

/** Write-a-program question. Spec in `code_specs`, tests in `code_tests`. */
export interface CodeQuestion extends QuestionBase {
  type: "code";
  language: CodeLanguage;        // code_specs.language
  starter: string | null;        // code_specs.starter: code the editor opens with
  solution: string | null;       // code_specs.solution
  setup: string | null;          // code_specs.setup: files/folders/tables needed on the learner's machine
  timeLimitMs: number;           // code_specs.time_limit_ms (default 3000)
  tests: CodeTest[];
}

/** A question as the app uses it. Switch on `type` to get the answer fields. */
export type Question = McqQuestion | MsqQuestion | NatQuestion | StrQuestion | CodeQuestion;

/** An earlier version of an edited question. Table: `question_history`.
 *  Lets a past mock review show the question exactly as it was when answered. */
export interface QuestionRevision {
  questionId: QuestionId;        // question_history.question_id
  rev: number;                   // question_history.rev
  snapshot: Question;            // question_history.snapshot (JSON of the full question)
  replacedAt: number;            // question_history.replaced_at
}
