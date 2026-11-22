// Which tables can change when a query writes to some table. A write to question_answers also
// changes question_stats, plan_question_ticks and plan_day_progress through triggers; deleting a
// plan deletes its days through ON DELETE CASCADE. Screens re-run their queries when a table they
// read changes, so the worker has to know all of these.
//
// Worked out from the schema itself when the database opens (triggers + foreign keys), so a
// query only lists the tables its own SQL writes, and nothing goes stale when the schema changes.

import type { Sql } from "@/lib/db/sql";

/** table → tables that may change as a direct result of writing to it. */
export type Effects = Map<string, Set<string>>;

const WRITE_TARGET = /\b(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|DELETE\s+FROM|UPDATE(?:\s+OR\s+\w+)?)\s+([A-Za-z_][\w]*)/gi;

function add(map: Effects, from: string, to: string) {
  if (from === to) return;
  let s = map.get(from);
  if (!s) map.set(from, (s = new Set()));
  s.add(to);
}

/** Reads the triggers and foreign keys of an open database. */
export function readEffects(sql: Sql): Effects {
  const map: Effects = new Map();
  const triggers = sql.all<{ tbl_name: string; sql: string }>(
    "SELECT tbl_name, sql FROM sqlite_master WHERE type = 'trigger'",
  );
  for (const t of triggers) {
    const body = t.sql.slice(t.sql.search(/\bBEGIN\b/i)); // skip the header ("AFTER UPDATE OF … ON …")
    for (const m of body.matchAll(WRITE_TARGET)) add(map, t.tbl_name.toLowerCase(), m[1].toLowerCase());
  }
  const fks = sql.all<{ child: string; parent: string; on_delete: string; on_update: string }>(
    `SELECT m.name AS child, f."table" AS parent, f.on_delete, f.on_update
     FROM sqlite_master m, pragma_foreign_key_list(m.name) f WHERE m.type = 'table'`,
  );
  for (const f of fks)
    if (f.on_delete !== "NO ACTION" || f.on_update !== "NO ACTION")
      add(map, f.parent.toLowerCase(), f.child.toLowerCase());
  return map;
}

/** Every table that may change when `written` are written to (follows chains of effects). */
export function affectedTables(written: Iterable<string>, effects: Effects): string[] {
  const seen = new Set<string>();
  const stack = [...written];
  while (stack.length) {
    const t = stack.pop()!;
    if (seen.has(t)) continue;
    seen.add(t);
    for (const next of effects.get(t) ?? []) stack.push(next);
  }
  return [...seen].sort();
}
