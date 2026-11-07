"use client";
import { withThemeTransition } from "@/lib/fx";

export default function ThemeToggle() {
  const flip = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    withThemeTransition(r.left + r.width / 2, r.top + r.height / 2, () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("gate.theme", next); } catch { /* ignore */ }
    });
  };
  const sparkle = () => window.dispatchEvent(new CustomEvent("gate-cosmos-now"));
  return (
    <div className="dock">
    <button className="dock-btn cosmic-btn" onClick={sparkle} aria-label="Trigger cosmic event" title="Trigger cosmic event">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2 6.2L20.5 12 14 14l-2 7-2-7-6.5-2L10 9.2z" /></svg>
    </button>
    <button className="dock-btn theme-btn" onClick={flip} aria-label="Switch between light and dark mode" title="Light / dark">
      <svg className="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      <svg className="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></svg>
    </button>
    </div>
  );
}
