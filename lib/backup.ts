// Backup file ("orbit-backup", version 1): everything the user owns, as one JSON file they can keep.
//
//   { "format": "orbit-backup", "version": 1, "schema_version": 1, "exported_at": 1763700000000,
//     "tables": { "subjects": [ {row}, … ], "questions": [ … ], … } }
//
// A row is the table's raw columns (JSON columns stay text, booleans stay 0 / 1). Pictures (BLOBs) are
// written as { "$b64": "…" }. The two cache tables (question_stats, plan_day_progress) are left out: the
// triggers rebuild them when the rows come back. Restoring replaces EVERYTHING in the database (queries
// `backup.import`, `app.startFresh` in lib/db/queries/backup.ts). Validation refuses with plain-English errors
// (AGENTS.md rule 5) before anything is deleted.
// NOTE: STORAGE.md §6 plans a .sqlite3 file backup; this JSON one works through the named queries in every
// tab and is tested in `bun run check`. See TODO.md if the file version is still wanted.

import { TABLES, type TableName } from "@/lib/db/sql";

export const BACKUP_FORMAT = "orbit-backup";
export const BACKUP_VERSION = 1;
export const BLOB_KEY = "$b64";
/** Most rows read per table when exporting (the "every list has a LIMIT" rule: this one is just very large). */
export const MAX_ROWS = 2_000_000;

/** Parents before the tables that refer to them: the order rows are put back in. Answers go in BEFORE the
 *  plan's tables on purpose: a trigger ticks a day's linked questions when an answer is inserted, and the
 *  backup already holds those ticks, so there must be no linked days yet. */
export const BACKUP_ORDER = [
  "subjects",
  "topics",
  "topic_ratings",
  "tags",
  "packs",
  "images",
  "questions",
  "question_mcq",
  "question_msq",
  "question_nat",
  "question_str",
  "question_code",
  "question_tags",
  "question_images",
  "mocks",
  "mock_sections",
  "mock_items",
  "mock_attempts",
  "mock_attempt_items",
  "question_answers",
  "plans",
  "plan_days",
  "milestones",
  "plan_tasks",
  "plan_day_questions",
  "plan_task_ticks",
  "plan_question_ticks",
] as const satisfies readonly TableName[];

/** Caches that triggers keep up to date: never exported, only emptied. */
export const DERIVED_TABLES = ["question_stats", "plan_day_progress"] as const satisfies readonly TableName[];

/** Every table in the schema is either backed up or derived (`bun run check` keeps this true). */
export const ALL_BACKUP_TABLES: readonly TableName[] = TABLES;

export type BackupValue = string | number | null | { [BLOB_KEY]: string };
export type BackupRow = Record<string, BackupValue>;
export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  schema_version: number;
  exported_at: number;
  tables: Partial<Record<TableName, BackupRow[]>>;
}
export interface BackupSummary {
  plan: string | null; // the active plan's name
  days: number;
  questions: number;
  answers: number;
  mocks: number;
  attempts: number;
  exportedAt: number;
}
export interface BackupParse {
  backup: BackupFile | null; // null = refused; see errors
  summary: BackupSummary | null;
  errors: string[];
}

// ------------------------------------------------------------------ pictures as text
const CHUNK = 0x8000;

export function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}
export function b64decode(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** A database row → a row of the file (pictures become text). */
export function encodeRow(row: Record<string, unknown>): BackupRow {
  const out: BackupRow = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Uint8Array) out[k] = { [BLOB_KEY]: b64encode(v) };
    else if (v === undefined) out[k] = null;
    else out[k] = v as string | number | null;
  }
  return out;
}
/** A row of the file → values the database accepts (pictures become bytes again). */
export function decodeValue(v: BackupValue): string | number | null | Uint8Array {
  return v !== null && typeof v === "object" ? b64decode(v[BLOB_KEY]) : v;
}

// ------------------------------------------------------------------ reading a file
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const NAME = /^[a-z_][a-z0-9_]*$/;
const MAX_ERRORS = 8;

/** Reads a backup (its text) and checks its shape. `schemaVersion`: the version this Orbit's database has
 *  (when given, a backup from another version is refused). Column names are checked against the real table
 *  by the importer before anything is written. */
export function parseBackup(input: string, schemaVersion?: number): BackupParse {
  const errors: string[] = [];
  const err = (m: string) => {
    if (errors.length < MAX_ERRORS) errors.push(m);
  };
  const refused = (): BackupParse => ({ backup: null, summary: null, errors });

  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch {
    err("This isn't a backup file. Choose the .json file saved by Orbit's “Export progress”.");
    return refused();
  }
  if (!isObj(data) || data.format !== BACKUP_FORMAT) {
    err(
      `This isn't an Orbit backup (its "format" should be "${BACKUP_FORMAT}"). Plan files and question files go in the steps above.`,
    );
    return refused();
  }
  if (data.version !== BACKUP_VERSION)
    err(`This backup is version ${String(data.version)}; this Orbit reads version ${BACKUP_VERSION}.`);
  if (typeof data.schema_version !== "number") err('The backup has no "schema_version".');
  else if (schemaVersion !== undefined && data.schema_version !== schemaVersion)
    err(
      `This backup was made by a ${data.schema_version > schemaVersion ? "newer" : "older"} Orbit (database version ${data.schema_version}; this one is ${schemaVersion}). Open it with the same version of Orbit that saved it.`,
    );
  if (typeof data.exported_at !== "number") err('The backup has no "exported_at".');
  if (!isObj(data.tables)) {
    err('The backup has no "tables".');
    return refused();
  }

  const known = new Set<string>(BACKUP_ORDER);
  for (const [name, rows] of Object.entries(data.tables)) {
    if (!known.has(name)) {
      err(`The backup has a table this Orbit doesn't know: "${name}".`);
      continue;
    }
    if (!Array.isArray(rows)) {
      err(`Table "${name}" must be a list of rows.`);
      continue;
    }
    for (const [i, row] of rows.entries()) {
      if (!isObj(row)) {
        err(`${name}[${i}] must be an object.`);
        break;
      }
      const bad = Object.entries(row).find(
        ([k, v]) =>
          !NAME.test(k) ||
          !(
            v === null ||
            typeof v === "string" ||
            typeof v === "number" ||
            (isObj(v) && typeof v[BLOB_KEY] === "string")
          ),
      );
      if (bad) {
        err(`${name}[${i}] has a value Orbit can't read (${bad[0]}).`);
        break;
      }
    }
  }
  if (errors.length) return refused();

  const backup = data as unknown as BackupFile;
  const n = (t: TableName) => backup.tables[t]?.length ?? 0;
  const plans = backup.tables.plans ?? [];
  const active = plans.find((p) => p.is_active === 1) ?? plans[0];
  return {
    backup,
    errors,
    summary: {
      plan: typeof active?.name === "string" ? active.name : null,
      days: n("plan_days"),
      questions: n("questions"),
      answers: n("question_answers"),
      mocks: n("mocks"),
      attempts: n("mock_attempts"),
      exportedAt: backup.exported_at,
    },
  };
}
