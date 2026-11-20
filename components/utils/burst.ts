// v1's confetti: a burst of small pieces flying out from a point and falling away (ticking a task).
// Does nothing when the user prefers reduced motion. Colours are theme tokens, so it follows light / dark.

const COLOURS = ["var(--accent)", "var(--red)", "var(--hi)", "var(--blue)", "var(--warm-c)"];
const calm = () => typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Throws `count` pieces from (x, y) in viewport pixels. */
export function burst(x: number, y: number, count = 28) {
  if (calm()) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("i");
    const size = 6 + Math.random() * 6;
    Object.assign(el.style, {
      position: "fixed",
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size * (Math.random() > 0.5 ? 1 : 0.5)}px`,
      background: COLOURS[i % COLOURS.length],
      borderRadius: Math.random() > 0.6 ? "50%" : "2px",
      pointerEvents: "none",
      zIndex: "9999",
    });
    document.body.appendChild(el);
    const a = Math.random() * Math.PI * 2;
    const v = 90 + Math.random() * 170;
    const dx = Math.cos(a) * v;
    const dy = Math.sin(a) * v - 90;
    el.animate(
      [
        { transform: "translate(0,0) rotate(0)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy + 260}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.15,.7,.3,1)" },
    ).onfinish = () => el.remove();
  }
}

/** Bursts from the middle of an element. */
export function burstFrom(el: Element, count?: number) {
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, count);
}
