import type { CosmicContext } from "@/components/background/cosmos/types";

export function cluster(ctx: CosmicContext) {
  const { W, H, dim, add, rand } = ctx;
  const k = dim();
  const cx = rand(0.15, 0.85) * W();
  const cy = rand(0.15, 0.75) * H();

  for (let i = 0; i < 46; i++) {
    const el = add(
      {
        left: `${cx + rand(-260, 260)}px`,
        top: `${cy + rand(-180, 180)}px`,
        color: ["#fff", "#ffe08a", "#9fd8ff", "#ffb3d1"][i % 4],
        fontSize: `${rand(12, 36)}px`,
        lineHeight: "1",
        textShadow: "0 0 14px currentColor",
      },
      [
        { opacity: 0, transform: "scale(.2) rotate(0deg)" },
        { opacity: k, transform: "scale(1.25) rotate(90deg)", offset: 0.4 },
        { opacity: 0, transform: "scale(.2) rotate(180deg)" },
      ],
      { duration: rand(2600, 4400), delay: rand(0, 3800), easing: "ease-in-out" },
    );
    el.textContent = "✦";
  }
}
