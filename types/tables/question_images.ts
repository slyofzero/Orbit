// Table `question_images`: which pictures a question uses (any type).
// Filled on save by scanning the stem, options and explanation.
// PRIMARY KEY (question_id, hash): a question lists each picture once.

import type { ImageHash, QuestionId } from "./common";

export interface QuestionImageRow {
  question_id: QuestionId; // → questions.id
  hash: ImageHash; // → images.hash
}
