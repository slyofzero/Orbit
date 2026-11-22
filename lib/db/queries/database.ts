// Database counts and what is loaded yet.
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.

import { read } from "@/lib/db/queries/core";

import { TABLES } from "@/lib/db/sql";

export const databaseQueries = {
  /** Row count of every table (for /dev/db and backups). */
  "db.counts": read(TABLES, (sql) =>
    TABLES.map((table) => ({ table, rows: sql.get<{ n: number }>(`SELECT count(*) AS n FROM ${table}`)!.n })),
  ),

  /** What is loaded yet: an active plan, and any (not retired) questions. Drives "Set up your study space". */
  "setup.status": read(["plans", "questions"], (sql) => {
    const r = sql.get<{ plan: number; questions: number }>(
      `SELECT EXISTS (SELECT 1 FROM plans WHERE is_active = 1) AS plan,
              EXISTS (SELECT 1 FROM questions WHERE retired_at IS NULL) AS questions`,
    )!;
    return { hasPlan: r.plan === 1, hasQuestions: r.questions === 1 };
  }),
};
