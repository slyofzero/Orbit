"use client";
import { useEffect, useRef } from "react";

type Kind = "supernova" | "nebula" | "shooting" | "comet" | "cluster" | "aurora" | "saturn" | "asteroid";
const KINDS: Kind[] = ["supernova", "nebula", "shooting", "comet", "cluster", "aurora", "saturn", "asteroid"];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Something happens in the sky behind the pages every 15 to 25 minutes (random). Konami code for the finale.
export default function Cosmos() {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const L = () => layer.current!;
    const dark = () => document.documentElement.dataset.theme === "dark";
    const dim = () => (dark() ? 1 : 0.85);
    const W = () => innerWidth, H = () => innerHeight;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)); };
    const phase = (k: string) => window.dispatchEvent(new CustomEvent("gate-cosmos-phase", { detail: k }));

    const add = (css: Partial<CSSStyleDeclaration>, anim: Keyframe[], opts: KeyframeAnimationOptions) => {
      const el = document.createElement("i");
      Object.assign(el.style, { position: "absolute", pointerEvents: "none", willChange: "transform, opacity", fontStyle: "normal", ...css });
      L().appendChild(el);
      const a = el.animate(anim, { fill: "forwards", ...opts });
      a.onfinish = () => el.remove();
      return el;
    };
    const flash = (peak: number, ms: number, color = "255,255,255") =>
      add({ inset: "0", background: `rgba(${color},1)` }, [{ opacity: 0 }, { opacity: peak, offset: 0.12 }, { opacity: 0 }], { duration: ms, easing: "ease-out" });
    const shake = (ms: number, amp: number) => {
      const frames = Array.from({ length: 14 }, (_, i) => ({ transform: i === 13 ? "translate(0,0)" : `translate(${rand(-amp, amp) * (1 - i / 14)}px, ${rand(-amp, amp) * (1 - i / 14)}px)` }));
      L().animate(frames, { duration: ms });
    };

    // ---------- the events ----------
    const supernova = (x = rand(0.2, 0.85) * W(), y = rand(0.15, 0.75) * H()) => {
      const k = dim();
      flash(0.28 * k, 1400, "255,240,220");
      add({ left: `${x - 460}px`, top: `${y - 460}px`, width: "920px", height: "920px", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,222,150,.85), rgba(255,90,120,.42) 36%, rgba(120,60,255,.2) 58%, transparent 72%)" },
        [{ opacity: 0, transform: "scale(.1)" }, { opacity: k, transform: "scale(.75)", offset: 0.22 }, { opacity: 0.6 * k, transform: "scale(1)", offset: 0.55 }, { opacity: 0, transform: "scale(1.4)" }], { duration: 6500, easing: "ease-out" });
      add({ left: `${x - 14}px`, top: `${y - 14}px`, width: "28px", height: "28px", borderRadius: "50%", background: "#fff", boxShadow: "0 0 70px 30px rgba(255,255,255,.95), 0 0 200px 90px rgba(255,170,90,.75)" },
        [{ opacity: 0, transform: "scale(.2)" }, { opacity: 1, transform: "scale(2.8)", offset: 0.1 }, { opacity: 0.8, transform: "scale(1.4)", offset: 0.45 }, { opacity: 0, transform: "scale(.2)" }], { duration: 4200, easing: "ease-out" });
      [0, 350, 700, 1050].forEach((d, i) =>
        add({ left: `${x - 50}px`, top: `${y - 50}px`, width: "100px", height: "100px", borderRadius: "50%", border: `${5 - i}px solid ${["#ffd28a", "#ff6b8b", "#8b7bff", "#6bd6ff"][i]}`, boxShadow: `0 0 30px ${["#ffd28a", "#ff6b8b", "#8b7bff", "#6bd6ff"][i]}` },
          [{ opacity: k, transform: "scale(.1)" }, { opacity: 0, transform: `scale(${13 + i * 2.5})` }], { duration: 4200, delay: d, easing: "cubic-bezier(.1,.7,.3,1)" }));
      for (let i = 0; i < 44; i++) {
        const a = rand(0, Math.PI * 2), r = rand(180, 560);
        add({ left: `${x - 3}px`, top: `${y - 3}px`, width: "6px", height: "6px", borderRadius: "50%", background: ["#fff", "#ffd28a", "#ff9ab0"][i % 3], boxShadow: "0 0 12px 3px rgba(255,220,160,.9)" },
          [{ opacity: 1, transform: "translate(0,0)" }, { opacity: 0, transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)` }], { duration: rand(2400, 4600), easing: "cubic-bezier(.1,.7,.3,1)" });
      }
    };
    const nebula = () => {
      const k = dim(), cols = ["rgba(255,70,170,.6)", "rgba(60,200,255,.55)", "rgba(140,90,255,.6)", "rgba(255,160,60,.5)", "rgba(40,230,170,.45)"];
      const cx = rand(0.2, 0.8) * W(), cy = rand(0.2, 0.7) * H();
      for (let i = 0; i < 9; i++) {
        const s = rand(420, 780), x = cx + rand(-320, 320), y = cy + rand(-220, 220);
        add({ left: `${x - s / 2}px`, top: `${y - s / 2}px`, width: `${s}px`, height: `${s}px`, borderRadius: "50%", background: `radial-gradient(circle, ${cols[i % cols.length]}, transparent 68%)`, filter: "blur(34px)" },
          [{ opacity: 0, transform: "scale(.5) translate(0,0)" }, { opacity: k, transform: "scale(1) translate(30px,-14px)", offset: 0.4 }, { opacity: 0, transform: "scale(1.3) translate(80px,-40px)" }], { duration: rand(11000, 15000), delay: i * 450, easing: "ease-in-out" });
      }
      for (let i = 0; i < 26; i++)
        add({ left: `${cx + rand(-440, 440)}px`, top: `${cy + rand(-300, 300)}px`, width: "4px", height: "4px", borderRadius: "50%", background: "#fff", boxShadow: "0 0 9px 3px rgba(255,255,255,.85)" },
          [{ opacity: 0 }, { opacity: k, offset: 0.5 }, { opacity: 0 }], { duration: rand(3000, 7000), delay: rand(500, 8000) });
    };
    const shooting = () => {
      const k = dim();
      [0, 0.5, 1.1, 1.6].forEach((d, i) => {
        const x = rand(0, 0.65) * W(), y = rand(0, 0.45) * H();
        add({ left: `${x}px`, top: `${y}px`, width: "340px", height: "4px", borderRadius: "4px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,.98))", transformOrigin: "0 50%", boxShadow: "0 0 18px 3px rgba(180,220,255,.8)" },
          [{ opacity: 0, transform: "rotate(28deg) translateX(0)" }, { opacity: k, transform: "rotate(28deg) translateX(240px)", offset: 0.15 }, { opacity: 0, transform: "rotate(28deg) translateX(1400px)" }], { duration: rand(1500, 2100), delay: d * 1000 + i * 120, easing: "ease-in" });
      });
    };
    const comet = () => {
      const k = dim(), y = rand(0.1, 0.4) * H(), total = W() + 900, dy = H() * 0.14, dur = 9500;
      add({ left: "-480px", top: `${y}px`, width: "480px", height: "20px", borderRadius: "20px", background: "linear-gradient(90deg, transparent, rgba(120,220,255,.4) 55%, #fff 97%)", filter: "blur(1.5px)", boxShadow: "0 0 40px 10px rgba(120,220,255,.6)" },
        [{ opacity: 0, transform: "translate(0,0) rotate(8deg)" }, { opacity: k, offset: 0.08 }, { opacity: k, offset: 0.9 }, { opacity: 0, transform: `translate(${total}px, ${dy}px) rotate(8deg)` }], { duration: dur, easing: "linear" });
      for (let i = 0; i < 26; i++) {
        const p = i / 26;
        add({ left: `${-480 + p * total + rand(-30, 0)}px`, top: `${y + p * dy + rand(-18, 22)}px`, width: "5px", height: "5px", borderRadius: "50%", background: "#cfeeff", boxShadow: "0 0 10px 3px rgba(150,225,255,.9)" },
          [{ opacity: 0 }, { opacity: k, offset: 0.15 }, { opacity: 0, transform: `translate(-80px, ${rand(20, 90)}px)` }], { duration: 2600, delay: p * dur * 0.92 });
      }
    };
    const cluster = () => {
      const k = dim(), cx = rand(0.15, 0.85) * W(), cy = rand(0.15, 0.75) * H();
      for (let i = 0; i < 46; i++) {
        const el = add({ left: `${cx + rand(-260, 260)}px`, top: `${cy + rand(-180, 180)}px`, color: ["#fff", "#ffe08a", "#9fd8ff", "#ffb3d1"][i % 4], fontSize: `${rand(12, 36)}px`, lineHeight: "1", textShadow: "0 0 14px currentColor" },
          [{ opacity: 0, transform: "scale(.2) rotate(0deg)" }, { opacity: k, transform: "scale(1.25) rotate(90deg)", offset: 0.4 }, { opacity: 0, transform: "scale(.2) rotate(180deg)" }], { duration: rand(2600, 4400), delay: rand(0, 3800), easing: "ease-in-out" });
        el.textContent = "✦";
      }
    };
    const aurora = () => {
      const k = dim(), d = dark(), cols = ["60,255,170", "40,220,255", "150,100,255", "255,90,200", "120,255,120"];
      const n = 12;
      for (let i = 0; i < n; i++) {
        const c = cols[i % cols.length], c2 = cols[(i + 2) % cols.length], w = W() / n * rand(1.5, 2.4), h = H() * rand(0.55, 0.85);
        add({ left: `${(i / n) * W() - w * 0.2}px`, top: `${-H() * 0.08}px`, width: `${w}px`, height: `${h}px`, background: `linear-gradient(to bottom, transparent, rgba(${c},.7) 28%, rgba(${c2},.5) 62%, transparent)`, filter: "blur(22px)", mixBlendMode: d ? "screen" : "normal", transformOrigin: "50% 0" },
          [{ opacity: 0, transform: "translateX(-40px) scaleY(.6) skewX(-8deg)" }, { opacity: 0.9 * k, transform: "translateX(10px) scaleY(1) skewX(4deg)", offset: 0.25 }, { opacity: 0.55 * k, transform: "translateX(50px) scaleY(1.08) skewX(-6deg)", offset: 0.55 }, { opacity: 0.85 * k, transform: "translateX(-10px) scaleY(.95) skewX(7deg)", offset: 0.8 }, { opacity: 0, transform: "translateX(40px) scaleY(.7) skewX(-4deg)" }], { duration: rand(13000, 17000), delay: i * 380, easing: "ease-in-out" });
      }
      for (let i = 0; i < 7; i++) {
        const c = cols[(i * 2) % cols.length];
        add({ left: `${rand(0.05, 0.9) * W()}px`, top: `${rand(0, 0.1) * H()}px`, width: `${W() * 0.025}px`, height: `${H() * rand(0.4, 0.65)}px`, background: `linear-gradient(to bottom, transparent, rgba(${c},.95) 35%, transparent)`, filter: "blur(7px)", mixBlendMode: d ? "screen" : "normal" },
          [{ opacity: 0, transform: "translateX(0) scaleY(.5)" }, { opacity: k, transform: "translateX(24px) scaleY(1)", offset: 0.4 }, { opacity: 0, transform: "translateX(-18px) scaleY(.8)" }], { duration: rand(6000, 9000), delay: rand(1500, 8000), easing: "ease-in-out" });
      }
    };
    const saturn = () => {
      const k = dim(), D = Math.max(200, Math.min(260, W() * 0.2)), cx = rand(0.35, 0.7) * W(), cy = rand(0.3, 0.55) * H(), TOT = 9800, BREAK = 4300 / TOT;
      const tilt = -18;
      const rings = [1.55, 1.9, 2.3].map((m, i) => ({ w: D * m, h: D * m * 0.3, bw: [7, 11, 5][i], col: ["rgba(255,225,165,.95)", "rgba(226,172,108,.85)", "rgba(255,244,210,.7)"][i], dx: [rand(-1, 1) * 600 - 700, rand(-1, 1) * 400 + 700, rand(-1, 1) * 400][i], dy: [-500, -350, 650][i], rot: [420, -520, 300][i] }));
      const ringEl = (r: (typeof rings)[number], front: boolean) =>
        add({ left: `${cx - r.w / 2}px`, top: `${cy - r.h / 2}px`, width: `${r.w}px`, height: `${r.h}px`, borderRadius: "50%", border: `${r.bw}px solid ${r.col}`, boxShadow: `0 0 20px ${r.col}`, clipPath: front ? "inset(50% 0 0 0)" : "none" },
          [{ opacity: 0, transform: `rotate(${tilt}deg) scale(.1)` }, { opacity: k, transform: `rotate(${tilt}deg) scale(1)`, offset: 0.19 }, { opacity: k, transform: `rotate(${tilt + 3}deg) scale(1.02)`, offset: BREAK, easing: "cubic-bezier(.5,0,1,.55)" }, { opacity: 0, transform: `translate(${r.dx}px, ${r.dy}px) rotate(${tilt + r.rot}deg) scale(2.4)`, offset: 0.8 }, { opacity: 0 }], { duration: TOT });
      rings.forEach((r) => ringEl(r, false));
      add({ left: `${cx - D / 2}px`, top: `${cy - D / 2}px`, width: `${D}px`, height: `${D}px`, borderRadius: "50%", background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,.4), transparent 38%), repeating-linear-gradient(0deg, #e6c88a 0 15px, #cf9f5f 15px 26px, #f2dfae 26px 40px)", boxShadow: "inset -26px -18px 46px rgba(70,35,0,.55), 0 0 70px rgba(255,210,140,.55)" },
        [{ opacity: 0, transform: `rotate(${tilt}deg) scale(.1)` }, { opacity: k, transform: `rotate(${tilt}deg) scale(1)`, offset: 0.19 }, { opacity: k, transform: `rotate(${tilt}deg) scale(1)`, offset: 0.78 }, { opacity: 0, transform: `rotate(${tilt}deg) scale(1.15)` }], { duration: TOT });
      rings.forEach((r) => ringEl(r, true));
      later(() => {
        phase("rings");
        flash(0.2 * k, 900, "255,230,190");
        for (let i = 0; i < 44; i++) {
          const a = rand(0, Math.PI * 2), r = rand(500, 1300), m = rings[i % 3];
          add({ left: `${cx + Math.cos(a) * m.w * 0.5}px`, top: `${cy + Math.sin(a) * m.h * 0.5}px`, width: `${rand(5, 12)}px`, height: `${rand(5, 12)}px`, borderRadius: "40%", background: m.col, boxShadow: `0 0 12px ${m.col}` },
            [{ opacity: k, transform: "translate(0,0) rotate(0)" }, { opacity: 0, transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px) rotate(${rand(200, 700)}deg)` }], { duration: rand(2200, 3800), easing: "cubic-bezier(.3,.1,.6,1)" });
        }
      }, TOT * BREAK);
    };
    const asteroid = () => {
      const k = dim(), TOT = 11800, HIT = 7200, w = W(), h = H();
      const ix = w * rand(0.42, 0.58), iy = h * 0.74, sx = w * rand(0.1, 0.25), sy = -80;
      const dx = ix - sx, dy = iy - sy, ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      // the camera dims the room and starts to fall
      add({ inset: "0", background: "rgba(3,5,16,.7)" }, [{ opacity: 0 }, { opacity: k, offset: 0.1 }, { opacity: k, offset: 0.86 }, { opacity: 0 }], { duration: TOT });
      for (let i = 0; i < 70; i++)
        add({ left: `${rand(0, w)}px`, top: `${rand(-0.2, 0.8) * h}px`, width: "3px", height: "3px", borderRadius: "50%", background: "#fff", boxShadow: "0 0 5px 1px rgba(255,255,255,.8)" },
          [{ opacity: 0, transform: "translateY(0) scale(.6)" }, { opacity: k, offset: 0.2 }, { opacity: 0, transform: `translateY(${h * 0.5}px) scale(2.2)` }], { duration: rand(5000, HIT), delay: rand(0, 2500), easing: "ease-in" });
      // earth rises into view
      const E = Math.max(w * 1.7, 1400);
      add({ left: `${(w - E) / 2}px`, top: `${iy}px`, width: `${E}px`, height: `${E}px`, borderRadius: "50%", background: "radial-gradient(ellipse 22% 3% at 32% 2.5%, #3f9b52, transparent), radial-gradient(ellipse 18% 2.6% at 64% 3.5%, #4aa35a, transparent), radial-gradient(circle at 50% 6%, #5ab4ff 0%, #2368c0 20%, #0b2f73 52%, #03091f 100%)", boxShadow: "0 -26px 90px 18px rgba(120,200,255,.6), inset 0 26px 70px rgba(170,225,255,.55)" },
        [{ transform: "translateY(62vh)" }, { transform: "translateY(0)", offset: 0.55, easing: "ease-out" }, { transform: "translateY(0)", offset: 0.87 }, { transform: "translateY(62vh)" }], { duration: TOT, easing: "ease-out" });
      // the asteroid, with the camera riding along: it grows as it comes in
      const rock = add({ left: `${sx}px`, top: `${sy}px`, width: "0", height: "0" },
        [{ opacity: 0, transform: "translate(0,0) scale(.3)" }, { opacity: 1, offset: 0.04 }, { opacity: 1, transform: `translate(${dx}px, ${dy}px) scale(3)`, offset: 1 }], { duration: HIT - 1200, delay: 1200, easing: "cubic-bezier(.5,0,.85,.55)" });
      rock.innerHTML = `<span style="position:absolute;left:-520px;top:-15px;width:520px;height:30px;border-radius:30px;background:linear-gradient(90deg,transparent,rgba(255,120,30,.55) 55%,rgba(255,240,170,.98));filter:blur(3px);transform-origin:100% 50%;transform:rotate(${ang}deg) translateX(0)"></span><span style="position:absolute;left:-19px;top:-19px;width:38px;height:38px;border-radius:48% 52% 40% 60% / 55% 45% 55% 45%;background:radial-gradient(circle at 35% 30%,#b9a894,#6a5646 55%,#2c211a);box-shadow:0 0 34px 12px rgba(255,150,60,.85),0 0 90px 30px rgba(255,90,30,.5)"></span>`;
      later(() => {
        phase("impact");
        flash(0.95 * k, 1500, "255,244,224");
        shake(1900, 16);
        const fb = (css: Partial<CSSStyleDeclaration>, a: Keyframe[], o: KeyframeAnimationOptions) => add({ left: `${ix}px`, top: `${iy}px`, ...css }, a, o);
        fb({ width: "420px", height: "420px", marginLeft: "-210px", marginTop: "-290px", borderRadius: "50%", background: "radial-gradient(circle, #fff6c8, #ffa13a 35%, rgba(255,60,20,.6) 60%, transparent 72%)" },
          [{ opacity: 1, transform: "scale(.2)" }, { opacity: 1, transform: "scale(1.8)", offset: 0.3 }, { opacity: 0, transform: "scale(2.8)" }], { duration: 3200, easing: "ease-out" });
        fb({ width: "360px", height: "360px", marginLeft: "-180px", marginTop: "-340px", borderRadius: "50%", background: "radial-gradient(circle, rgba(90,60,48,.85), rgba(40,28,24,.5) 55%, transparent 72%)", filter: "blur(10px)" },
          [{ opacity: 0, transform: "translateY(0) scale(.4)" }, { opacity: 0.9, offset: 0.2 }, { opacity: 0, transform: "translateY(-260px) scale(2.6)" }], { duration: 5600, easing: "ease-out" });
        [0, 300, 650].forEach((d, i) => fb({ width: "120px", height: "28px", marginLeft: "-60px", marginTop: "-14px", borderRadius: "50%", border: `${4 - i}px solid ${["#fff3c0", "#ffb04a", "#ff6a3a"][i]}`, boxShadow: "0 0 24px rgba(255,150,60,.9)" },
          [{ opacity: 1, transform: "scale(.2)" }, { opacity: 0, transform: `scale(${22 + i * 5})` }], { duration: 3200, delay: d, easing: "cubic-bezier(.1,.7,.3,1)" }));
        for (let i = 0; i < 46; i++) {
          const sp = rand(-1, 1), up = rand(140, 520);
          fb({ width: `${rand(4, 9)}px`, height: `${rand(4, 9)}px`, borderRadius: "40%", background: ["#ffd27a", "#ff7a3a", "#fff", "#b9a894"][i % 4], boxShadow: "0 0 12px 3px rgba(255,150,60,.85)" },
            [{ opacity: 1, transform: "translate(0,0)" }, { opacity: 1, transform: `translate(${sp * 360}px, ${-up}px)`, offset: 0.4, easing: "ease-in" }, { opacity: 0, transform: `translate(${sp * 560}px, ${rand(0, 120)}px)` }], { duration: rand(2400, 4200), easing: "ease-out" });
        }
        fb({ width: "240px", height: "40px", marginLeft: "-120px", marginTop: "-20px", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,140,50,.95), transparent 70%)", filter: "blur(6px)" },
          [{ opacity: 1, transform: "scale(1)" }, { opacity: 0.8, offset: 0.5 }, { opacity: 0, transform: "scale(1.6)" }], { duration: 4300 });
      }, HIT);
    };

    const table: Record<Kind, () => void> = { supernova, nebula, shooting, comet, cluster, aurora, saturn, asteroid };
    let last: Kind | null = null;
    const run = (k?: Kind) => {
      if (calm()) return;
      let kind = k;
      if (!kind) { do kind = KINDS[Math.floor(Math.random() * KINDS.length)]; while (kind === last); }
      last = kind;
      table[kind]();
      window.dispatchEvent(new CustomEvent("gate-cosmos", { detail: kind }));
    };

    // schedule: first one after ~25 s, then one every 15-25 minutes (random) while the tab is visible
    let t: ReturnType<typeof setTimeout>;
    const loop = (ms: number) => { t = setTimeout(() => { if (!document.hidden) run(); loop(rand(15 * 60_000, 25 * 60_000)); }, ms); };
    loop(25_000);

    const manual = (e: Event) => run((e as CustomEvent).detail as Kind | undefined);
    window.addEventListener("gate-cosmos-now", manual);

    // secret: up up down down left right left right b a
    const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    let pos = 0;
    const key = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      pos = k === code[pos] ? pos + 1 : k === code[0] ? 1 : 0;
      if (pos === code.length) {
        pos = 0;
        if (calm()) return;
        window.dispatchEvent(new CustomEvent("gate-finale"));
        supernova(W() * 0.3, H() * 0.35); later(() => supernova(W() * 0.7, H() * 0.5), 450); later(() => supernova(W() * 0.5, H() * 0.75), 900);
        aurora(); nebula(); later(cluster, 600); later(shooting, 1200); later(shooting, 3000);
      }
    };
    window.addEventListener("keydown", key);
    return () => { clearTimeout(t); timers.forEach(clearTimeout); window.removeEventListener("gate-cosmos-now", manual); window.removeEventListener("keydown", key); };
  }, []);

  return <div className="cosmos" ref={layer} aria-hidden="true" />;
}
