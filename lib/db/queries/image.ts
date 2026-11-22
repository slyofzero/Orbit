// Pictures (table `images`, stored once by content hash; docs/COMPONENTS.md "Pictures"). Named queries
// (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts. The editor saves a picked or pasted file with
// `image.add` and writes `![alt](img:<hash>)` into the text; screens show it through `image.get`.
//
// How often a picture is used = its rows in `question_images` (one per question using it; filled when a question is
// saved, removed with the question). That is the count, so it can never drift from the questions. A picture used 0
// times is deleted by `image.sweep`, which the database worker runs when it opens and every hour
// (lib/db/worker.ts), once the picture is older than UNUSED_IMAGE_GRACE_MS.

import { read, write } from "@/lib/db/queries/core";
import { UNUSED_IMAGE_GRACE_MS, imageProblem } from "@/lib/images";

export const imageQueries = {
  /** Saves a picture (checked: an image type, 1 byte to 5 MB, `hash` = lib/images.ts hashImage of the bytes, made by
   *  the caller because a query can't wait) and returns its name. The same bytes are stored once. */
  "image.add": write(
    ["images"],
    (
      sql,
      p: { hash: string; bytes: Uint8Array; mime: string; width?: number | null; height?: number | null },
    ): { ok: true; hash: string } | { ok: false; error: string } => {
      const problem = imageProblem({ type: p.mime, size: p.bytes.byteLength });
      if (problem) return { ok: false, error: problem };
      if (p.bytes.byteLength === 0) return { ok: false, error: "That picture is empty." };
      const hash = p.hash;
      if (!/^h[0-9a-f]{32}$/.test(hash)) return { ok: false, error: "That picture has no valid name." };
      sql.run("INSERT OR IGNORE INTO images (hash, mime, width, height, added_at, bytes) VALUES (?, ?, ?, ?, ?, ?)", [
        hash,
        p.mime,
        p.width && p.width > 0 ? Math.round(p.width) : null,
        p.height && p.height > 0 ? Math.round(p.height) : null,
        Date.now(),
        p.bytes,
      ]);
      return { ok: true, hash };
    },
  ),

  /** One picture's type and bytes, or null when there is none by that name. */
  "image.get": read(
    ["images"],
    (sql, p: { hash: string }) =>
      sql.get<{ mime: string; bytes: Uint8Array }>("SELECT mime, bytes FROM images WHERE hash = ?", [p.hash]) ?? null,
  ),

  /** Stored pictures with how many questions use each (0 = unused, swept once old enough), most used first, a page
   *  at a time (`limit` at most 200). The picture bytes are not loaded. */
  "image.usage": read(["images", "question_images"], (sql, p: { limit: number; offset?: number }) =>
    sql.all<{ hash: string; mime: string; size: number; added_at: number; uses: number }>(
      `SELECT i.hash, i.mime, length(i.bytes) AS size, i.added_at,
              (SELECT count(*) FROM question_images qi WHERE qi.hash = i.hash) AS uses
       FROM images i ORDER BY uses DESC, i.added_at DESC LIMIT ? OFFSET ?`,
      [Math.max(1, Math.min(200, Math.floor(p.limit))), Math.max(0, Math.floor(p.offset ?? 0))],
    ),
  ),

  /** Deletes every picture no question uses that is older than UNUSED_IMAGE_GRACE_MS (`now` for tests).
   *  Returns how many went. */
  "image.sweep": write(["images"], (sql, p: { now?: number } = {}): { removed: number } => {
    const before = (p?.now ?? Date.now()) - UNUSED_IMAGE_GRACE_MS;
    const removed = sql.run(
      `DELETE FROM images WHERE added_at < ?
         AND NOT EXISTS (SELECT 1 FROM question_images qi WHERE qi.hash = images.hash)`,
      [before],
    );
    return { removed };
  }),
};
