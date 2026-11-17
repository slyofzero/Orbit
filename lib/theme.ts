// Theme choice: "light", "dark", or "system" (follow the operating system).
// Saved in localStorage as "orbit.theme" (one of the few things kept outside the database,
// because it is needed before anything else loads). "system" = key absent.
// Applied as <html data-theme="light|dark">; no attribute = follow the system (see app/site.css).

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_KEY = "orbit.theme";

/** Inline <head> script: applies the saved choice before the first paint. Must stay tiny and never throw. */
export const THEME_BOOT_SCRIPT =
  `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function readTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* storage blocked (private mode): the choice still applies for this visit */
  }
}
