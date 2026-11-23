import type { CosmicContext } from "@/components/background/cosmos/types";

export function saturn(ctx: CosmicContext) {
  const { W, H, dim, add, rand, later, phase, flash } = ctx;
  const k = dim();
  const D = Math.max(200, Math.min(260, W() * 0.2));
  const cx = rand(0.35, 0.7) * W();
  const cy = rand(0.3, 0.55) * H();
  const TOT = 9800;
  const BREAK = 4300 / TOT;
  const tilt = -18;

  const rings = [1.55, 1.9, 2.3].map((m, i) => ({
    w: D * m,
    h: D * m * 0.3,
    bw: [7, 11, 5][i],
    col: ["rgba(255,225,165,.95)", "rgba(226,172,108,.85)", "rgba(255,244,210,.7)"][i],
    dx: [rand(-1, 1) * 600 - 700, rand(-1, 1) * 400 + 700, rand(-1, 1) * 400][i],
    dy: [-500, -350, 650][i],
    rot: [420, -520, 300][i],
  }));

  const ringEl = (r: (typeof rings)[number], front: boolean) =>
    add(
      {
        left: `${cx - r.w / 2}px`,
        top: `${cy - r.h / 2}px`,
        width: `${r.w}px`,
        height: `${r.h}px`,
        borderRadius: "50%",
        border: `${r.bw}px solid ${r.col}`,
        boxShadow: `0 0 20px ${r.col}`,
        clipPath: front ? "inset(50% 0 0 0)" : "none",
      },
      [
        { opacity: 0, transform: `rotate(${tilt}deg) scale(.1)` },
        { opacity: k, transform: `rotate(${tilt}deg) scale(1)`, offset: 0.19 },
        {
          opacity: k,
          transform: `rotate(${tilt + 3}deg) scale(1.02)`,
          offset: BREAK,
          easing: "cubic-bezier(.5,0,1,.55)",
        },
        {
          opacity: 0,
          transform: `translate(${r.dx}px, ${r.dy}px) rotate(${tilt + r.rot}deg) scale(2.4)`,
          offset: 0.8,
        },
        { opacity: 0 },
      ],
      { duration: TOT },
    );

  rings.forEach((r) => ringEl(r, false));

  add(
    {
      left: `${cx - D / 2}px`,
      top: `${cy - D / 2}px`,
      width: `${D}px`,
      height: `${D}px`,
      borderRadius: "50%",
      background:
        "radial-gradient(circle at 32% 28%, rgba(255,255,255,.4), transparent 38%), repeating-linear-gradient(0deg, #e6c88a 0 15px, #cf9f5f 15px 26px, #f2dfae 26px 40px)",
      boxShadow: "inset -26px -18px 46px rgba(70,35,0,.55), 0 0 70px rgba(255,210,140,.55)",
    },
    [
      { opacity: 0, transform: `rotate(${tilt}deg) scale(.1)` },
      { opacity: k, transform: `rotate(${tilt}deg) scale(1)`, offset: 0.19 },
      { opacity: k, transform: `rotate(${tilt}deg) scale(1)`, offset: 0.78 },
      { opacity: 0, transform: `rotate(${tilt}deg) scale(1.15)` },
    ],
    { duration: TOT },
  );

  rings.forEach((r) => ringEl(r, true));

  later(() => {
    phase("rings");
    flash(0.2 * k, 900, "255,230,190");
    for (let i = 0; i < 44; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(500, 1300);
      const m = rings[i % 3];
      add(
        {
          left: `${cx + Math.cos(a) * m.w * 0.5}px`,
          top: `${cy + Math.sin(a) * m.h * 0.5}px`,
          width: `${rand(5, 12)}px`,
          height: `${rand(5, 12)}px`,
          borderRadius: "40%",
          background: m.col,
          boxShadow: `0 0 12px ${m.col}`,
        },
        [
          { opacity: k, transform: "translate(0,0) rotate(0)" },
          {
            opacity: 0,
            transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px) rotate(${rand(200, 700)}deg)`,
          },
        ],
        { duration: rand(2200, 3800), easing: "cubic-bezier(.3,.1,.6,1)" },
      );
    }
  }, TOT * BREAK);
}
