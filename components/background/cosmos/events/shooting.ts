import type { CosmicContext } from "@/components/background/cosmos/types";

export function shooting(ctx: CosmicContext) {
  const { W, H, dim, add, rand } = ctx;
  const k = dim();
  [0, 0.5, 1.1, 1.6].forEach((d, i) => {
    const x = rand(0, 0.65) * W();
    const y = rand(0, 0.45) * H();
    add(
      {
        left: `${x}px`,
        top: `${y}px`,
        width: "340px",
        height: "4px",
        borderRadius: "4px",
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,.98))",
        transformOrigin: "0 50%",
        boxShadow: "0 0 18px 3px rgba(180,220,255,.8)",
      },
      [
        { opacity: 0, transform: "rotate(28deg) translateX(0)" },
        { opacity: k, transform: "rotate(28deg) translateX(240px)", offset: 0.15 },
        { opacity: 0, transform: "rotate(28deg) translateX(1400px)" },
      ],
      { duration: rand(1500, 2100), delay: d * 1000 + i * 120, easing: "ease-in" },
    );
  });
}
