// Brings a database file up to the newest schema version.
//
//   * A new (empty) file gets db/schema.sql: the version-1 baseline. Once shipped, that file
//     is never edited again.
//   * Every later change is a migration: db/migrations/NNN-name.sql, listed in
//     lib/db/migrations.ts with its version number (2, 3, …). Each runs once, in order, in its
//     own transaction, and sets PRAGMA user_version to its number.
//   * A file from a NEWER Orbit (higher version than this code knows) is refused, never
//     touched, so an old tab can't damage data a newer version wrote.

import { transaction, type Sql } from "@/lib/db/sql";

export interface Migration {
  version: number; // 2, 3, … (1 is db/schema.sql)
  sql: string;
}

export interface MigrateResult {
  from: number; // version the file had (0 = new file)
  to: number; // version it has now
}

/** The version this code expects: the last migration, or 1. Throws if the list has gaps. */
export function latestVersion(migrations: readonly Migration[]): number {
  let v = 1;
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (m.version !== v + 1)
      throw new Error(`Migrations must be numbered 2, 3, 4… without gaps (found ${m.version} after ${v})`);
    v = m.version;
  }
  return v;
}

export function migrate(sql: Sql, schema: string, migrations: readonly Migration[]): MigrateResult {
  const latest = latestVersion(migrations);
  const userVersion = () => sql.get<{ user_version: number }>("PRAGMA user_version")!.user_version;
  const from = userVersion();
  if (from > latest)
    throw new Error(
      `This data was saved by a newer version of Orbit (schema ${from}; this one knows ${latest}). Reload the page.`,
    );
  if (from === 0)
    transaction(sql, () => {
      sql.exec(schema);
      if (userVersion() !== 1) throw new Error("db/schema.sql must set PRAGMA user_version = 1");
    });
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (m.version <= userVersion()) continue;
    transaction(sql, () => {
      sql.exec(m.sql);
      sql.exec(`PRAGMA user_version = ${m.version}`);
    });
  }
  return { from, to: userVersion() };
}
