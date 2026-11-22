// Converts rows between the database and the TypeScript types in types/tables/.
// SQLite has no arrays or booleans: arrays are stored as JSON text, booleans as 0 / 1.
// bun run check verifies that every array / boolean field in types/tables/ is listed here.

import type { Row, SqlValue, TableName } from "@/lib/db/sql";

/** Columns holding a JSON array (or JSON objects in an array). */
export const JSON_COLUMNS: Partial<Record<TableName, readonly string[]>> = {
  question_mcq: ["options"],
  question_msq: ["options", "correct"],
  question_str: ["accepted"],
  mock_attempts: ["sections"],
  mock_attempt_items: ["choice"],
  plans: ["original_milestones"],
};

/** Columns holding a boolean as 0 / 1. */
export const BOOL_COLUMNS: Partial<Record<TableName, readonly string[]>> = {
  question_str: ["case_sensitive"],
  mocks: ["full_screen"],
  mock_attempt_items: ["visited", "marked"],
  plans: ["is_active"],
};

/** A database row → the table's TypeScript type. Columns not in the row are left alone. */
export function decode<T>(table: TableName, row: Row): T {
  const out: Record<string, unknown> = { ...row };
  for (const c of JSON_COLUMNS[table] ?? []) {
    const v = out[c];
    if (typeof v === "string") out[c] = JSON.parse(v);
  }
  for (const c of BOOL_COLUMNS[table] ?? []) {
    const v = out[c];
    if (v !== undefined && v !== null) out[c] = v === 1;
  }
  return out as T;
}

/** A (partial) TypeScript row → values the database accepts. */
export function encode(table: TableName, row: Record<string, unknown>): Record<string, SqlValue> {
  const out: Record<string, unknown> = { ...row };
  for (const c of JSON_COLUMNS[table] ?? []) {
    const v = out[c];
    if (v !== undefined && v !== null) out[c] = JSON.stringify(v);
  }
  for (const c of BOOL_COLUMNS[table] ?? []) {
    const v = out[c];
    if (typeof v === "boolean") out[c] = v ? 1 : 0;
  }
  return out as Record<string, SqlValue>;
}

/**
 * INSERT one row: `insert(sql, "plans", {...})`. Column names come from the object's keys,
 * which come from typed rows in our own code, never from user input.
 */
export function insertSql(table: TableName, row: Record<string, unknown>): { query: string; params: SqlValue[] } {
  const enc = encode(table, row);
  const cols = Object.keys(enc);
  return {
    query: `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    params: cols.map((c) => enc[c]),
  };
}
