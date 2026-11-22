// Backup, restore and "start fresh".
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.

import { read, write } from "@/lib/db/queries/core";

import { type Sql, type TableName } from "@/lib/db/sql";

import {
  BACKUP_FORMAT,
  BACKUP_ORDER,
  BACKUP_VERSION,
  DERIVED_TABLES,
  MAX_ROWS,
  decodeValue,
  encodeRow,
  parseBackup,
  type BackupFile,
} from "@/lib/backup";

/** Every table a backup restore or "start fresh" writes (the backed-up ones and the caches). */
const EVERY_TABLE: readonly TableName[] = [...BACKUP_ORDER, ...DERIVED_TABLES];

/** Empties every table: children before the tables they refer to, then the caches. The triggers keep the
 *  search index in step. Always called inside a write query (one transaction). */
function wipeAll(sql: Sql) {
  for (const t of [...BACKUP_ORDER].reverse()) sql.run(`DELETE FROM ${t}`);
  for (const t of DERIVED_TABLES) sql.run(`DELETE FROM ${t}`);
}

export const backupQueries = {
  /** 🔴 "Start fresh": deletes everything the user owns (plan, questions, mocks, answers, ticks, milestones…).
   *  The screen clears the browser's own storage after this and goes back to /onboarding. */
  "app.startFresh": write(EVERY_TABLE, (sql) => {
    wipeAll(sql);
    return true;
  }),

  /** "Export progress": every backed-up table as one JSON text (lib/backup.ts). */
  "backup.export": read(BACKUP_ORDER, (sql) => {
    const tables: BackupFile["tables"] = {};
    let questions = 0;
    let answers = 0;
    for (const t of BACKUP_ORDER) {
      const rows = sql.all<Record<string, unknown>>(`SELECT * FROM ${t} LIMIT ${MAX_ROWS}`);
      if (!rows.length) continue;
      tables[t] = rows.map(encodeRow);
      if (t === "questions") questions = rows.length;
      if (t === "question_answers") answers = rows.length;
    }
    const file: BackupFile = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      schema_version: sql.get<{ user_version: number }>("PRAGMA user_version")!.user_version,
      exported_at: Date.now(),
      tables,
    };
    return { text: JSON.stringify(file), questions, answers };
  }),

  /** 🔴 Restores a backup: REPLACES everything in the database with the file's rows. The file and its column
   *  names are checked first, so a refused file deletes nothing; a database error part-way rolls it all back. */
  "backup.import": write(EVERY_TABLE, (sql, p: { text: string }) => {
    const version = sql.get<{ user_version: number }>("PRAGMA user_version")!.user_version;
    const r = parseBackup(p.text, version);
    if (!r.backup) return { ok: false as const, errors: r.errors };
    const errors: string[] = [];
    for (const t of BACKUP_ORDER) {
      const rows = r.backup.tables[t];
      if (!rows?.length) continue;
      const have = new Set(
        sql.all<{ name: string }>(`SELECT name FROM pragma_table_info('${t}') LIMIT 200`).map((c) => c.name),
      );
      const unknown = new Set(rows.flatMap((row) => Object.keys(row)).filter((k) => !have.has(k)));
      if (unknown.size) errors.push(`Table "${t}" has columns this Orbit doesn't know: ${[...unknown].join(", ")}.`);
    }
    if (errors.length) return { ok: false as const, errors };

    wipeAll(sql);
    for (const t of BACKUP_ORDER)
      for (const row of r.backup.tables[t] ?? []) {
        const cols = Object.keys(row);
        sql.run(
          `INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
          cols.map((c) => decodeValue(row[c])),
        );
      }
    return { ok: true as const, ...r.summary! };
  }),
};
