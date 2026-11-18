// Shared building blocks for every table: IDs and enums.
//
// Conventions:
//   * One type per table; field names are the column names (snake_case).
//   * Times are Unix milliseconds (UTC). Calendar days are IsoDate strings (YYYY-MM-DD, IST).
//   * IDs are opaque strings ('q_8f2a1c0d9b'); they never encode a topic, subject or position.
//   * Text that can hold maths is markdown + $LaTeX$; pictures are written as ![alt](img:<hash>).
//   * The SQL is db/schema.sql. There, arrays (string[], number[], {…}[]) are JSON text and
//     booleans are INTEGER 0/1; the database worker converts both ways, so code only sees
//     the types written here.

/** Numeric ID of a small lookup table (e.g. tags.id). */
export type RowId = number;
/** `q_…` → questions.id */
export type QuestionId = string;
/** `sb_…` → subjects.id */
export type SubjectId = string;
/** `tp_…` → topics.id */
export type TopicId = string;
/** `pk_…` → packs.id */
export type PackId = string;
/** `mk_…` → mocks.id */
export type MockId = string;
/** → mock_sections.id */
export type MockSectionId = number;
/** `at_…` → mock_attempts.id */
export type AttemptId = string;
/** `pl_…` → plans.id */
export type PlanId = string;
/** → plan_days.id */
export type PlanDayId = number;
/** → plan_tasks.id */
export type PlanTaskId = number;
/** A calendar day, `YYYY-MM-DD`, in IST (never a Date). */
export type IsoDate = string;
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
/** How much of a plan day got done. Only days with at least one task or question have one. */
export type PlanDayStatus = "done" | "partial" | "incomplete";
/**
 * Where a mock attempt stands.
 *   in_progress = started, not finished (can be resumed after a refresh)
 *   submitted   = finished normally; the only status that is scored and counts in stats
 *   abandoned   = the user quit; kept for history, not scored
 *   failed      = ended for breaking a rule (e.g. leaving full screen); not scored
 */
export type AttemptStatus = "in_progress" | "submitted" | "abandoned" | "failed";
/** The user's own feeling about a topic. */
export type TopicRating = "know" | "shaky" | "no_idea";
