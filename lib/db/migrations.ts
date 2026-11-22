// Every schema change after version 1, in order. Only the worker imports this file.
//
// To change the schema:
//   1. Write db/migrations/002-what-it-does.sql (ALTER TABLE / CREATE … ; no PRAGMA needed).
//   2. Add it below:  import m002 from "@/db/migrations/002-what-it-does.sql";
//                     { version: 2, sql: m002 },
//   3. Update the matching types in types/tables/ and run bun run check.
// Never edit db/schema.sql or a migration once it has shipped.

import type { Migration } from "@/lib/db/migrate";

export const MIGRATIONS: Migration[] = [];
