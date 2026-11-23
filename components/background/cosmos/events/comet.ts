import type { CosmicContext } from "@/components/background/cosmos/types";

export function comet(ctx: CosmicContext) {
  const { W, H, dim, add, rand } = ctx;
  const k = dim();
  const y = rand(0.1, 0.4) * H();
  const total = W() + 900;
  const dy = H() * 0.14;
  const dur = 9500;

  add(
    {
      left: "-480px",
      top: `${y}px`,
      width: "480px",
      height: "20px",
      borderRadius: "20px",
      background: "linear-gradient(90deg, transparent, rgba(120,220,255,.4) 55%, #fff 97%)",
      filter: "blur(1.5px)",
      boxShadow: "0 0 40px 10px rgba(120,220,255,.6)",
    },
    [
      { opacity: 0, transform: "translate(0,0) rotate(8deg)" },
      { opacity: k, offset: 0.08 },
      { opacity: k, offset: 0.9 },
      { opacity: 0, transform: `translate(${total}px, ${dy}px) rotate(8deg)` },
    ],
    { duration: dur, easing: "linear" },
  );

  for (let i = 0; i < 26; i++) {
    const p = i / 26;
    add(
      {
        left: `${-480 + p * total + rand(-30, 0)}px`,
        top: `${y + p * dy + rand(-18, 22)}px`,
        width: "5px",
        height: "5px",
        borderRadius: "50%",
        background: "#cfeeff",
        boxShadow: "0 0 10px 3px rgba(150,225,255,.9)",
      },
      [{ opacity: 0 }, { opacity: k, offset: 0.15 }, { opacity: 0, transform: `translate(-80px, ${rand(20, 90)}px)` }],
      { duration: 2600, delay: p * dur * 0.92 },
    );
  }
}
