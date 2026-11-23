import type { CosmicContext } from "@/components/background/cosmos/types";

export function aurora(ctx: CosmicContext) {
  const { W, H, dim, dark, add, rand } = ctx;
  const k = dim();
  const d = dark();
  const cols = ["60,255,170", "40,220,255", "150,100,255", "255,90,200", "120,255,120"];
  const n = 12;

  for (let i = 0; i < n; i++) {
    const c = cols[i % cols.length];
    const c2 = cols[(i + 2) % cols.length];
    const w = (W() / n) * rand(1.5, 2.4);
    const h = H() * rand(0.55, 0.85);
    add(
      {
        left: `${(i / n) * W() - w * 0.2}px`,
        top: `${-H() * 0.08}px`,
        width: `${w}px`,
        height: `${h}px`,
        background: `linear-gradient(to bottom, transparent, rgba(${c},.7) 28%, rgba(${c2},.5) 62%, transparent)`,
        filter: "blur(22px)",
        mixBlendMode: d ? "screen" : "normal",
        transformOrigin: "50% 0",
      },
      [
        { opacity: 0, transform: "translateX(-40px) scaleY(.6) skewX(-8deg)" },
        { opacity: 0.9 * k, transform: "translateX(10px) scaleY(1) skewX(4deg)", offset: 0.25 },
        { opacity: 0.55 * k, transform: "translateX(50px) scaleY(1.08) skewX(-6deg)", offset: 0.55 },
        { opacity: 0.85 * k, transform: "translateX(-10px) scaleY(.95) skewX(7deg)", offset: 0.8 },
        { opacity: 0, transform: "translateX(40px) scaleY(.7) skewX(-4deg)" },
      ],
      { duration: rand(13000, 17000), delay: i * 380, easing: "ease-in-out" },
    );
  }

  for (let i = 0; i < 7; i++) {
    const c = cols[(i * 2) % cols.length];
    add(
      {
        left: `${rand(0.05, 0.9) * W()}px`,
        top: `${rand(0, 0.1) * H()}px`,
        width: `${W() * 0.025}px`,
        height: `${H() * rand(0.4, 0.65)}px`,
        background: `linear-gradient(to bottom, transparent, rgba(${c},.95) 35%, transparent)`,
        filter: "blur(7px)",
        mixBlendMode: d ? "screen" : "normal",
      },
      [
        { opacity: 0, transform: "translateX(0) scaleY(.5)" },
        { opacity: k, transform: "translateX(24px) scaleY(1)", offset: 0.4 },
        { opacity: 0, transform: "translateX(-18px) scaleY(.8)" },
      ],
      { duration: rand(6000, 9000), delay: rand(1500, 8000), easing: "ease-in-out" },
    );
  }
}
