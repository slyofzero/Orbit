// Building blocks for the named queries: the QueryDef shape and the read() / write() helpers.

import type { Sql, TableName } from "@/lib/db/sql";

export interface QueryDef<P, R> {
  kind: "read" | "write";
  tables: readonly TableName[];
  run: (sql: Sql, params: P) => R;
}

export function read<P = void, R = unknown>(
  tables: readonly TableName[],
  run: (sql: Sql, params: P) => R,
): QueryDef<P, R> {
  return { kind: "read", tables, run };
}
export function write<P = void, R = unknown>(
  tables: readonly TableName[],
  run: (sql: Sql, params: P) => R,
): QueryDef<P, R> {
  return { kind: "write", tables, run };
}
