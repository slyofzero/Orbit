import type { CosmicContext } from "@/components/background/cosmos/types";

export function supernova(ctx: CosmicContext, x?: number, y?: number) {
  const { W, H, dim, flash, add, rand } = ctx;
  const cx = x ?? rand(0.2, 0.85) * W();
  const cy = y ?? rand(0.15, 0.75) * H();
  const k = dim();

  flash(0.28 * k, 1400, "255,240,220");

  add(
    {
      left: `${cx - 460}px`,
      top: `${cy - 460}px`,
      width: "920px",
      height: "920px",
      borderRadius: "50%",
      background:
        "radial-gradient(circle, rgba(255,222,150,.85), rgba(255,90,120,.42) 36%, rgba(120,60,255,.2) 58%, transparent 72%)",
    },
    [
      { opacity: 0, transform: "scale(.1)" },
      { opacity: k, transform: "scale(.75)", offset: 0.22 },
      { opacity: 0.6 * k, transform: "scale(1)", offset: 0.55 },
      { opacity: 0, transform: "scale(1.4)" },
    ],
    { duration: 6500, easing: "ease-out" },
  );

  add(
    {
      left: `${cx - 14}px`,
      top: `${cy - 14}px`,
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "0 0 70px 30px rgba(255,255,255,.95), 0 0 200px 90px rgba(255,170,90,.75)",
    },
    [
      { opacity: 0, transform: "scale(.2)" },
      { opacity: 1, transform: "scale(2.8)", offset: 0.1 },
      { opacity: 0.8, transform: "scale(1.4)", offset: 0.45 },
      { opacity: 0, transform: "scale(.2)" },
    ],
    { duration: 4200, easing: "ease-out" },
  );

  [0, 350, 700, 1050].forEach((d, i) =>
    add(
      {
        left: `${cx - 50}px`,
        top: `${cy - 50}px`,
        width: "100px",
        height: "100px",
        borderRadius: "50%",
        border: `${5 - i}px solid ${["#ffd28a", "#ff6b8b", "#8b7bff", "#6bd6ff"][i]}`,
        boxShadow: `0 0 30px ${["#ffd28a", "#ff6b8b", "#8b7bff", "#6bd6ff"][i]}`,
      },
      [
        { opacity: k, transform: "scale(.1)" },
        { opacity: 0, transform: `scale(${13 + i * 2.5})` },
      ],
      { duration: 4200, delay: d, easing: "cubic-bezier(.1,.7,.3,1)" },
    ),
  );

  for (let i = 0; i < 44; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(180, 560);
    add(
      {
        left: `${cx - 3}px`,
        top: `${cy - 3}px`,
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: ["#fff", "#ffd28a", "#ff9ab0"][i % 3],
        boxShadow: "0 0 12px 3px rgba(255,220,160,.9)",
      },
      [
        { opacity: 1, transform: "translate(0,0)" },
        { opacity: 0, transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)` },
      ],
      { duration: rand(2400, 4600), easing: "cubic-bezier(.1,.7,.3,1)" },
    );
  }
}
