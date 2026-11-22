// Settings: the user's own settings (table `settings`; keys, defaults and checks in lib/settings.ts).
// Named queries (docs/STORAGE.md §2); how to write one: lib/db/queries/index.ts.

import { read, write } from "@/lib/db/queries/core";
import { checkSetting, readSettings, SETTING_DEFAULTS } from "@/lib/settings";

const MAX_KEYS = Object.keys(SETTING_DEFAULTS).length + 50;

export const settingsQueries = {
  /** Every setting, defaults filled in for keys with no row. */
  "settings.all": read(["settings"], (sql) =>
    readSettings(sql.all<{ key: string; value: string }>(`SELECT key, value FROM settings LIMIT ${MAX_KEYS}`)),
  ),

  /** Saves one setting (checked by lib/settings.ts). An empty value removes the row, so it reads as the default. */
  "settings.set": write(["settings"], (sql, p: { key: string; value: string }) => {
    const c = checkSetting(p.key, p.value);
    if (c.value === null) return { ok: false as const, error: c.error! };
    if (c.value === "") sql.run("DELETE FROM settings WHERE key = ?", [p.key]);
    else
      sql.run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [p.key, c.value, Date.now()],
      );
    return { ok: true as const, value: c.value };
  }),
};
