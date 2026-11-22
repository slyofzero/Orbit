// Pictures (table `images`, stored once by content hash; docs/COMPONENTS.md "Pictures"). Named queries
// (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts. The editor saves a picked or pasted file with
// `image.add` and writes `![alt](img:<hash>)` into the text; screens show it through `image.get`.

import { read, write } from "@/lib/db/queries/core";
import { imageProblem } from "@/lib/images";

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
};
