import type { CosmicContext } from "@/components/background/cosmos/types";

export function nebula(ctx: CosmicContext) {
  const { W, H, dim, add, rand } = ctx;
  const k = dim();
  const cols = [
    "rgba(255,70,170,.6)",
    "rgba(60,200,255,.55)",
    "rgba(140,90,255,.6)",
    "rgba(255,160,60,.5)",
    "rgba(40,230,170,.45)",
  ];
  const cx = rand(0.2, 0.8) * W();
  const cy = rand(0.2, 0.7) * H();

  for (let i = 0; i < 9; i++) {
    const s = rand(420, 780);
    const x = cx + rand(-320, 320);
    const y = cy + rand(-220, 220);
    add(
      {
        left: `${x - s / 2}px`,
        top: `${y - s / 2}px`,
        width: `${s}px`,
        height: `${s}px`,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${cols[i % cols.length]}, transparent 68%)`,
        filter: "blur(34px)",
      },
      [
        { opacity: 0, transform: "scale(.5) translate(0,0)" },
        { opacity: k, transform: "scale(1) translate(30px,-14px)", offset: 0.4 },
        { opacity: 0, transform: "scale(1.3) translate(80px,-40px)" },
      ],
      { duration: rand(11000, 15000), delay: i * 450, easing: "ease-in-out" },
    );
  }

  for (let i = 0; i < 26; i++) {
    add(
      {
        left: `${cx + rand(-440, 440)}px`,
        top: `${cy + rand(-300, 300)}px`,
        width: "4px",
        height: "4px",
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 0 9px 3px rgba(255,255,255,.85)",
      },
      [{ opacity: 0 }, { opacity: k, offset: 0.5 }, { opacity: 0 }],
      { duration: rand(3000, 7000), delay: rand(500, 8000) },
    );
  }
}
