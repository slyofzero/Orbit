// Shared building blocks for the question tables: IDs and enums.
//
// Conventions:
//   * One type per table; field names are the column names (snake_case).
//   * Times are Unix milliseconds (UTC).
//   * IDs are opaque strings ('q_8f2a1c0d9b'); they never encode a topic, subject or position.
//   * Text that can hold maths is markdown + $LaTeX$; pictures are written as ![alt](img:<hash>).

/** Numeric ID of a small lookup table (e.g. tags.id). */
export type RowId = number;
/** `q_…` → questions.id */
export type QuestionId = string;
/** `tp_…` → topics.id */
export type TopicId = string;
/** `pk_…` → packs.id */
export type PackId = string;
/** SHA-256 based name of a picture (`h…`) → images.hash */
export type ImageHash = string;

export type QuestionType = "mcq" | "msq" | "nat" | "str" | "code";
export type Difficulty = "easy" | "medium" | "hard";
/** `practice` = shown in practice; `mock` = only appears inside mock tests. */
export type QuestionPool = "practice" | "mock";
/** How a typed text answer is compared: whole string, ordered list, or unordered set. */
export type StrMatch = "exact" | "list" | "set";
/** What happened to a question in one sitting. `skipped` = shown but left unanswered. */
export type AnswerOutcome = "correct" | "incorrect" | "skipped";
/** Where an answer was given. */
export type AnswerSource = "practice" | "mock";
