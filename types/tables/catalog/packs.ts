// Table `packs`: one row per imported question pack file (content).
// Questions and mocks remember which pack they came from (pack_id), so a pack can be
// re-imported or removed as a unit. Things added by hand have pack_id null.
// PRIMARY KEY (id)

import type { PackId } from "@/types/tables/common";

export interface PackRow {
  id: PackId; // PRIMARY KEY
  name: string; // from the pack file, editable
  file_name: string | null; // the file it was imported from
  file_hash: string | null; // SHA-256 of that file: importing the same file again is spotted
  imported_at: number;
  updated_at: number; // last re-import
}
