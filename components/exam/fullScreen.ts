// Full screen for mocks marked `full_screen`. Entering must happen inside a click (browsers refuse it otherwise).

/** Asks for full screen. Returns an error to show, or null when it worked. */
export async function enterFullScreen(): Promise<string | null> {
  const el = document.documentElement;
  if (document.fullscreenElement) return null;
  if (!el.requestFullscreen)
    return "This browser can't run the test in full screen. Use Chrome, Edge or Firefox on a laptop or desktop.";
  try {
    await el.requestFullscreen();
    return null;
  } catch {
    return "Full screen was blocked. Allow it for this site and press the button again.";
  }
}

export function exitFullScreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

export const inFullScreen = () => !!document.fullscreenElement;
