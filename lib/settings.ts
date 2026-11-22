// The user's own settings (table `settings`, one row per key). Every key, its default and its check live here;
// the settings.* queries (lib/db/queries/settings.ts) refuse anything this file doesn't accept.

export const NAME_MAX = 40;

/** Every setting there is, with its default. A key with no row reads as its default. */
export const SETTING_DEFAULTS = {
  /** what the dashboard greeting calls you ("Good morning, Asha"); "" = no name */
  name: "",
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = { [K in SettingKey]: string };

export const isSettingKey = (k: string): k is SettingKey => Object.hasOwn(SETTING_DEFAULTS, k);

/** Checks and tidies one setting's value. `value` is what is stored ("" deletes the row: back to the default). */
export function checkSetting(key: string, raw: string): { value: string | null; error: string | null } {
  if (!isSettingKey(key)) return { value: null, error: `"${key}" isn't a setting.` };
  if (key === "name") {
    const v = raw.replace(/\s+/g, " ").trim();
    if (v.length > NAME_MAX) return { value: null, error: `Your name can be at most ${NAME_MAX} characters.` };
    return { value: v, error: null };
  }
  return { value: raw, error: null };
}

/** Rows from the table → every setting, defaults filled in. Unknown keys are ignored. */
export function readSettings(rows: readonly { key: string; value: string }[]): Settings {
  const out: Settings = { ...SETTING_DEFAULTS };
  for (const r of rows) if (isSettingKey(r.key)) out[r.key] = r.value;
  return out;
}
