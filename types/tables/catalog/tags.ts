// Table `tags`: free labels for questions, e.g. "conceptual", "has figure" (content).
// question_tags links them to questions.
// PRIMARY KEY (id). UNIQUE (name).

import type { RowId } from "@/types/tables/common";

export interface TagRow {
  id: RowId; // PRIMARY KEY (small integer, so question_tags stays compact)
  name: string; // UNIQUE, compared without case
}
