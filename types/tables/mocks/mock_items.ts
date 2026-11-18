// Table `mock_items`: which questions a section holds, in order (content).
// PRIMARY KEY (section_id, question_id). The importer also refuses the same question
// in two sections of one mock.

import type { MockSectionId, QuestionId } from "@/types/tables/common";

export interface MockItemRow {
  section_id: MockSectionId; // → mock_sections.id
  question_id: QuestionId; // → questions.id
  position: number; // REAL: order inside the section
}
