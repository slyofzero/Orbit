// Table `topics`: one topic inside a subject, e.g. "Eigenvalues" (content).
// Every question belongs to exactly one topic (questions.topic_id).
// PRIMARY KEY (id). UNIQUE (subject_id, name).

import type { SubjectId, TopicId } from "@/types/tables/common";

export interface TopicRow {
  id: TopicId; // PRIMARY KEY
  subject_id: SubjectId; // → subjects.id
  name: string;
  position: number; // REAL: order inside the subject
  legacy_id: string | null; // v2 ID, never shown in the UI
  retired_at: number | null; // set = hidden; its questions and history are kept
}
