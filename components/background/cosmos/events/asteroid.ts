import type { CosmicContext } from "@/components/background/cosmos/types";

export function asteroid(ctx: CosmicContext) {
  const { W, H, dim, add, rand, later, phase, flash, shake } = ctx;
  const k = dim();
  const TOT = 11800;
  const HIT = 7200;
  const w = W();
  const h = H();
  const ix = w * rand(0.42, 0.58);
  const iy = h * 0.74;
  const sx = w * rand(0.1, 0.25);
  const sy = -80;
  const dx = ix - sx;
  const dy = iy - sy;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;

  // room dimming
  add(
    { inset: "0", background: "rgba(3,5,16,.7)" },
    [{ opacity: 0 }, { opacity: k, offset: 0.1 }, { opacity: k, offset: 0.86 }, { opacity: 0 }],
    { duration: TOT },
  );

  for (let i = 0; i < 70; i++) {
    add(
      {
        left: `${rand(0, w)}px`,
        top: `${rand(-0.2, 0.8) * h}px`,
        width: "3px",
        height: "3px",
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 0 5px 1px rgba(255,255,255,.8)",
      },
      [
        { opacity: 0, transform: "translateY(0) scale(.6)" },
        { opacity: k, offset: 0.2 },
        { opacity: 0, transform: `translateY(${h * 0.5}px) scale(2.2)` },
      ],
      { duration: rand(5000, HIT), delay: rand(0, 2500), easing: "ease-in" },
    );
  }

  // earth rising
  const E = Math.max(w * 1.7, 1400);
  add(
    {
      left: `${(w - E) / 2}px`,
      top: `${iy}px`,
      width: `${E}px`,
      height: `${E}px`,
      borderRadius: "50%",
      background:
        "radial-gradient(ellipse 22% 3% at 32% 2.5%, #3f9b52, transparent), radial-gradient(ellipse 18% 2.6% at 64% 3.5%, #4aa35a, transparent), radial-gradient(circle at 50% 6%, #5ab4ff 0%, #2368c0 20%, #0b2f73 52%, #03091f 100%)",
      boxShadow: "0 -26px 90px 18px rgba(120,200,255,.6), inset 0 26px 70px rgba(170,225,255,.55)",
    },
    [
      { transform: "translateY(62vh)" },
      { transform: "translateY(0)", offset: 0.55, easing: "ease-out" },
      { transform: "translateY(0)", offset: 0.87 },
      { transform: "translateY(62vh)" },
    ],
    { duration: TOT, easing: "ease-out" },
  );

  // incoming asteroid
  const rock = add(
    { left: `${sx}px`, top: `${sy}px`, width: "0", height: "0" },
    [
      { opacity: 0, transform: "translate(0,0) scale(.3)" },
      { opacity: 1, offset: 0.04 },
      { opacity: 1, transform: `translate(${dx}px, ${dy}px) scale(3)`, offset: 1 },
    ],
    { duration: HIT - 1200, delay: 1200, easing: "cubic-bezier(.5,0,.85,.55)" },
  );
  rock.innerHTML = `<span style="position:absolute;left:-520px;top:-15px;width:520px;height:30px;border-radius:30px;background:linear-gradient(90deg,transparent,rgba(255,120,30,.55) 55%,rgba(255,240,170,.98));filter:blur(3px);transform-origin:100% 50%;transform:rotate(${ang}deg) translateX(0)"></span><span style="position:absolute;left:-19px;top:-19px;width:38px;height:38px;border-radius:48% 52% 40% 60% / 55% 45% 55% 45%;background:radial-gradient(circle at 35% 30%,#b9a894,#6a5646 55%,#2c211a);box-shadow:0 0 34px 12px rgba(255,150,60,.85),0 0 90px 30px rgba(255,90,30,.5)"></span>`;

  later(() => {
    phase("impact");
    flash(0.95 * k, 1500, "255,244,224");
    shake(1900, 16);
    const fb = (css: Partial<CSSStyleDeclaration>, a: Keyframe[], o: KeyframeAnimationOptions) =>
      add({ left: `${ix}px`, top: `${iy}px`, ...css }, a, o);

    fb(
      {
        width: "420px",
        height: "420px",
        marginLeft: "-210px",
        marginTop: "-290px",
        borderRadius: "50%",
        background: "radial-gradient(circle, #fff6c8, #ffa13a 35%, rgba(255,60,20,.6) 60%, transparent 72%)",
      },
      [
        { opacity: 1, transform: "scale(.2)" },
        { opacity: 1, transform: "scale(1.8)", offset: 0.3 },
        { opacity: 0, transform: "scale(2.8)" },
      ],
      { duration: 3200, easing: "ease-out" },
    );

    fb(
      {
        width: "360px",
        height: "360px",
        marginLeft: "-180px",
        marginTop: "-340px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(90,60,48,.85), rgba(40,28,24,.5) 55%, transparent 72%)",
        filter: "blur(10px)",
      },
      [
        { opacity: 0, transform: "translateY(0) scale(.4)" },
        { opacity: 0.9, offset: 0.2 },
        { opacity: 0, transform: "translateY(-260px) scale(2.6)" },
      ],
      { duration: 5600, easing: "ease-out" },
    );

    [0, 300, 650].forEach((d, i) =>
      fb(
        {
          width: "120px",
          height: "28px",
          marginLeft: "-60px",
          marginTop: "-14px",
          borderRadius: "50%",
          border: `${4 - i}px solid ${["#fff3c0", "#ffb04a", "#ff6a3a"][i]}`,
          boxShadow: "0 0 24px rgba(255,150,60,.9)",
        },
        [
          { opacity: 1, transform: "scale(.2)" },
          { opacity: 0, transform: `scale(${22 + i * 5})` },
        ],
        { duration: 3200, delay: d, easing: "cubic-bezier(.1,.7,.3,1)" },
      ),
    );

    for (let i = 0; i < 46; i++) {
      const sp = rand(-1, 1);
      const up = rand(140, 520);
      fb(
        {
          width: `${rand(4, 9)}px`,
          height: `${rand(4, 9)}px`,
          borderRadius: "40%",
          background: ["#ffd27a", "#ff7a3a", "#fff", "#b9a894"][i % 4],
          boxShadow: "0 0 12px 3px rgba(255,150,60,.85)",
        },
        [
          { opacity: 1, transform: "translate(0,0)" },
          {
            opacity: 1,
            transform: `translate(${sp * 360}px, ${-up}px)`,
            offset: 0.4,
            easing: "ease-in",
          },
          { opacity: 0, transform: `translate(${sp * 560}px, ${rand(0, 120)}px)` },
        ],
        { duration: rand(2400, 4200), easing: "ease-out" },
      );
    }

    fb(
      {
        width: "240px",
        height: "40px",
        marginLeft: "-120px",
        marginTop: "-20px",
        borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(255,140,50,.95), transparent 70%)",
        filter: "blur(6px)",
      },
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0.8, offset: 0.5 },
        { opacity: 0, transform: "scale(1.6)" },
      ],
      { duration: 4300 },
    );
  }, HIT);
}
