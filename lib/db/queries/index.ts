// The NAMED QUERIES: the only way screens read or change data (docs/STORAGE.md §2).
// A screen calls useQuery("name", params) / useMutation("name"); the worker looks the name up
// here and runs it. SQL lives in the files of this folder (one per area) and nowhere else.
//
// Adding one:
//   "plan.day": read(["plan_days", "plan_tasks"], (sql, p: { date: IsoDate }) => …),
//   "plan.tickTask": write(["plan_task_ticks"], (sql, p: { taskId: number }) => …),
//   * read(tables, fn): `tables` = every table the SQL reads. When any of them changes (in any
//     tab), screens using the query re-run it.
//   * write(tables, fn): `tables` = the tables the SQL itself writes. Tables changed by
//     triggers and cascades are worked out from the schema (lib/db/effects.ts). The whole
//     function runs in one transaction.
//   * Params and results must be plain data (objects, arrays, strings, numbers, Uint8Array):
//     they are copied between threads and tabs.
//   * Convert rows with decode() / insertSql() (lib/db/codec.ts) so screens get the types in
//     types/tables/, never raw JSON text or 0/1.
//   * Every list has a LIMIT. Pure logic (grading, streaks…) stays in lib/ and is called from here.

import { databaseQueries } from "@/lib/db/queries/database";
import { planQueries } from "@/lib/db/queries/plan";
import { packQueries } from "@/lib/db/queries/pack";
import { backupQueries } from "@/lib/db/queries/backup";
import { dashboardQueries } from "@/lib/db/queries/dashboard";
import { practiceQueries } from "@/lib/db/queries/practice";
import { plannerQueries } from "@/lib/db/queries/planner";
import { questionQueries } from "@/lib/db/queries/question";
import { devQueries } from "@/lib/db/queries/dev";
import type { QueryDef } from "@/lib/db/queries/core";

export type { QueryDef };

/** Every named query: one object per area, joined. A name must be used once. */
export const QUERIES = {
  ...databaseQueries,
  ...planQueries,
  ...packQueries,
  ...backupQueries,
  ...dashboardQueries,
  ...practiceQueries,
  ...plannerQueries,
  ...questionQueries,
  ...devQueries,
};

export type QueryName = keyof typeof QUERIES;
export type ParamsOf<N extends QueryName> = (typeof QUERIES)[N] extends QueryDef<infer P, unknown> ? P : never;
export type ResultOf<N extends QueryName> = (typeof QUERIES)[N] extends QueryDef<never, infer R> ? R : never;
/** The arguments after the name: none for queries without params. */
export type ArgsOf<N extends QueryName> = [ParamsOf<N>] extends [void] ? [] : [ParamsOf<N>];
