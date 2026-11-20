// Theme choice: "light", "dark", or "system" (follow the operating system).
// Saved in localStorage as "orbit.theme" (one of the few things kept outside the database,
// because it is needed before anything else loads). "system" = key absent.
// Applied as <html data-theme="light|dark">; no attribute = follow the system (see styles/site.css).

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_KEY = "orbit.theme";

/** Inline <head> script: applies the saved choice before the first paint. Must stay tiny and never throw. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function readTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

/** Switches theme with v1's ripple: the new theme is revealed as a circle growing from (x, y) until it
 *  covers the screen. Uses View Transitions; without them, or with "reduce motion" on, it just switches. */
export function applyThemeWithRipple(choice: ThemeChoice, x: number, y: number): void {
  const d = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (calm || !d.startViewTransition) {
    applyTheme(choice);
    return;
  }
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)); // reach the farthest corner
  // The new-theme layer exists one frame before `ready` fires. styles/theme-ripple.css clips it to a zero-size
  // circle at this point from the very first frame; without that it flashes full-screen and then
  // snaps to nothing, which looks like a jitter.
  const root = document.documentElement;
  root.style.setProperty("--ripple-x", `${x}px`);
  root.style.setProperty("--ripple-y", `${y}px`);
  const t = d.startViewTransition(() => applyTheme(choice));
  t.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        // slow, gentle ease-in-out: a fast burst at the start felt jarring.
        // fill "forwards" holds the full circle until the transition ends, so the end can't flash either.
        {
          duration: 1100,
          easing: "cubic-bezier(0.45, 0, 0.25, 1)",
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        },
      ),
    )
    .catch(() => {
      /* transition skipped (e.g. tab hidden): the theme has still changed */
    });
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
