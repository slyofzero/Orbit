// Table `images`: one row per distinct picture, stored once even if many questions use it.
// Questions refer to a picture by writing ![alt](img:<hash>) in their text;
// question_images maps questions to the pictures they use.
// PRIMARY KEY (hash)

import type { ImageHash } from "./common";

export interface ImageRow {
  hash: ImageHash; // PRIMARY KEY: content hash; the name used in img:<hash>
  mime: string; // 'image/png', 'image/jpeg', …
  bytes: Uint8Array; // the picture itself (raw binary, not base64)
  width: number | null;
  height: number | null;
  added_at: number;
}
