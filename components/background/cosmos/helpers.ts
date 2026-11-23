import type { CosmicContext } from "@/components/background/cosmos/types";

export const rand = (a: number, b: number) => a + Math.random() * (b - a);

export const calm = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createCosmicContext(layer: HTMLDivElement, timers: ReturnType<typeof setTimeout>[]): CosmicContext {
  const dark = () => document.documentElement.dataset.theme === "dark";
  const dim = () => (dark() ? 1 : 0.85);
  const W = () => window.innerWidth;
  const H = () => window.innerHeight;

  const later = (fn: () => void, ms: number) => {
    timers.push(setTimeout(fn, ms));
  };

  const phase = (k: string) => {
    window.dispatchEvent(new CustomEvent("gate-cosmos-phase", { detail: k }));
  };

  const add = (css: Partial<CSSStyleDeclaration>, anim: Keyframe[], opts: KeyframeAnimationOptions) => {
    const el = document.createElement("i");
    Object.assign(el.style, {
      position: "absolute",
      pointerEvents: "none",
      willChange: "transform, opacity",
      fontStyle: "normal",
      ...css,
    });
    layer.appendChild(el);
    const a = el.animate(anim, { fill: "forwards", ...opts });
    a.onfinish = () => el.remove();
    return el;
  };

  const flash = (peak: number, ms: number, color = "255,255,255") =>
    add(
      { inset: "0", background: `rgba(${color},1)` },
      [{ opacity: 0 }, { opacity: peak, offset: 0.12 }, { opacity: 0 }],
      { duration: ms, easing: "ease-out" },
    );

  const shake = (ms: number, amp: number) => {
    const frames = Array.from({ length: 14 }, (_, i) => ({
      transform:
        i === 13
          ? "translate(0,0)"
          : `translate(${rand(-amp, amp) * (1 - i / 14)}px, ${rand(-amp, amp) * (1 - i / 14)}px)`,
    }));
    layer.animate(frames, { duration: ms });
  };

  return {
    layer,
    dark,
    dim,
    W,
    H,
    rand,
    later,
    phase,
    add,
    flash,
    shake,
  };
}
