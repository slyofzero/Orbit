// Small celebratory effects. All of them do nothing when the person prefers reduced motion.
const COLORS = ["#2dd4bf", "#ff5d73", "#ffc933", "#2e9bff", "#ff8a3d"];
const calm = () => typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function burst(x: number, y: number, count = 28) {
  if (calm()) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("i");
    const size = 6 + Math.random() * 6;
    Object.assign(el.style, {
      position: "fixed", left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size * (Math.random() > 0.5 ? 1 : 0.5)}px`,
      background: COLORS[i % COLORS.length], borderRadius: Math.random() > 0.6 ? "50%" : "2px", pointerEvents: "none", zIndex: "9999",
    });
    document.body.appendChild(el);
    const a = Math.random() * Math.PI * 2, v = 90 + Math.random() * 170;
    const dx = Math.cos(a) * v, dy = Math.sin(a) * v - 90;
    el.animate(
      [{ transform: "translate(0,0) rotate(0)", opacity: 1 }, { transform: `translate(${dx}px, ${dy + 260}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }],
      { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.15,.7,.3,1)" }
    ).onfinish = () => el.remove();
  }
}

// Circular reveal when switching theme, where the browser supports view transitions.
export function withThemeTransition(x: number, y: number, change: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  if (calm() || !d.startViewTransition) return change();
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const t = d.startViewTransition(change);
  t.ready.then(() =>
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 650, easing: "cubic-bezier(.2,.7,.2,1)", pseudoElement: "::view-transition-new(root)" }
    )
  );
}
