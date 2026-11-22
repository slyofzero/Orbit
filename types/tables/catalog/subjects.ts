// Table `subjects`: the top level of the syllabus, e.g. "Linear Algebra" (content).
// Topics belong to a subject; stats roll up topic → subject.
// PRIMARY KEY (id)

import type { SubjectId } from "@/types/tables/common";

export interface SubjectRow {
  id: SubjectId; // PRIMARY KEY
  name: string; // UNIQUE
  position: number; // REAL: display order, inserting never renumbers
  legacy_id: string | null; // v2 ID ('la', 'prob'…), never shown in the UI
}
