// The question tables of the Orbit database, one file per table, named after the table.
// Main table `questions` holds what every question has; one table per type holds the extras.
//
//   questions ──┬── question_mcq          (1 row: options + correct index)
//               ├── question_msq          (1 row: options + correct indexes)
//               ├── question_nat          (1 row)
//               ├── question_str          (1 row: match rules + accepted answers)
//               ├── question_code         (1 row: optional starter code)
//               ├─< question_tags         (→ tags, not defined yet)
//               ├─< question_images  >── images (one row per distinct picture)
//               ├─< question_answers      (1 row per question per sitting: outcome + time)
//               └── question_stats        (1 row: visited / correct / incorrect; summary of question_answers)

export * from "./common";

export type { QuestionRow } from "./questions";
export type { QuestionMcqRow } from "./question_mcq";
export type { QuestionMsqRow } from "./question_msq";
export type { QuestionNatRow } from "./question_nat";
export type { QuestionStrRow } from "./question_str";
export type { QuestionCodeRow } from "./question_code";
export type { QuestionTagRow } from "./question_tags";
export type { QuestionImageRow } from "./question_images";
export type { ImageRow } from "./images";
export type { QuestionAnswerRow } from "./question_answers";
export type { QuestionStatRow } from "./question_stats";
