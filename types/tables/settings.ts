// Table `settings`: the user's own settings, one row per key (state).
// No row = the default. Which keys exist and what their values may be: lib/settings.ts.
// PRIMARY KEY (key)

export interface SettingRow {
  key: string; // PRIMARY KEY, e.g. 'name'
  value: string; // checked by lib/settings.ts before it is saved
  updated_at: number;
}
