// The question tables. Each question belongs to a topic (catalog/). Main table `questions`
// holds what every question has; one table per type holds the extras (in `question_types/`).
//
//   questions ──┬── question_mcq          (1 row: options + correct index)
//               ├── question_msq          (1 row: options + correct indexes)
//               ├── question_nat          (1 row)
//               ├── question_str          (1 row: match rules + accepted answers)
//               ├── question_code         (1 row: optional starter code)
//               ├─< question_tags     >── tags (catalog/)
//               ├─< question_images  >── images (one row per distinct picture)
//               ├─< question_answers      (1 row per question per sitting: outcome + time)
//               └── question_stats        (1 row: visited / correct / incorrect; summary of question_answers)

export type { QuestionRow } from "@/types/tables/questions/questions";
export type { QuestionMcqRow } from "@/types/tables/questions/question_types/question_mcq";
export type { QuestionMsqRow } from "@/types/tables/questions/question_types/question_msq";
export type { QuestionNatRow } from "@/types/tables/questions/question_types/question_nat";
export type { QuestionStrRow } from "@/types/tables/questions/question_types/question_str";
export type { QuestionCodeRow } from "@/types/tables/questions/question_types/question_code";
export type { QuestionTagRow } from "@/types/tables/questions/question_tags";
export type { QuestionImageRow } from "@/types/tables/questions/question_images";
export type { QuestionAnswerRow } from "@/types/tables/questions/question_answers";
export type { QuestionStatRow } from "@/types/tables/questions/question_stats";
