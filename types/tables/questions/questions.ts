// Table `questions`: the fields every question has, whatever its type.
// The type-specific fields live in question_mcq / question_msq / question_nat /
// question_str / question_code. Everything else in the app refers to questions.id.
// PRIMARY KEY (id)

import type { Difficulty, PackId, QuestionId, QuestionPool, QuestionType, TopicId } from "@/types/tables/common";

export interface QuestionRow {
  id: QuestionId; // PRIMARY KEY: what every other table refers to
  type: QuestionType; // says which type table holds the rest
  topic_id: TopicId; // → topics.id
  pack_id: PackId | null; // → packs.id; null = added by hand
  pool: QuestionPool;
  marks: number; // > 0
  negative_marks: number; // >= 0; 0 = no negative marking
  difficulty: Difficulty;
  stem: string;
  explanation: string | null;
  content_hash: string; // finds true duplicates
  legacy_id: string | null; // v2 ID, never shown in the UI
  created_at: number;
  updated_at: number;
  retired_at: number | null; // set = hidden, kept for history
}
