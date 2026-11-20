"use client";
// A small animated universe on a <canvas>: a glowing sun, planets on tilted orbits (one with a moon),
// twinkling stars and the odd comet. Colours come from the theme tokens and follow light / dark.
// Decorative only (aria-hidden). With reduced motion it draws a single still frame.

import { useEffect, useRef } from "react";
import { cx } from "@/components/utils";

type Palette = Record<"hi" | "sun" | "a" | "b" | "c" | "ink", string>;

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim() || "#888";
  return {
    hi: v("--hi"),
    sun: v("--warm-c"),
    a: v("--special-a"),
    b: v("--special-b"),
    c: v("--special-c"),
    ink: v("--ink"),
  };
}

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

/** `sunX`, `sunY` = where the sun sits, as fractions of the canvas (default: right of centre). */
export function OrbitScene({
  className,
  sunX = 0.72,
  sunY = 0.5,
}: {
  className?: string;
  sunX?: number;
  sunY?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pal = readPalette();
    let w = 0;
    let h = 0;
    let raf = 0;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const stars: Star[] = Array.from({ length: 110 }, () => ({
      x: rnd(),
      y: rnd(),
      r: 0.4 + rnd() * 1.3,
      phase: rnd() * Math.PI * 2,
      speed: 0.6 + rnd() * 1.6,
    }));
    const planets = [
      { orbit: 0.2, speed: 0.55, size: 5, color: "a" as const, phase: 0.4 },
      { orbit: 0.34, speed: 0.32, size: 8, color: "b" as const, phase: 2.1, moon: true },
      { orbit: 0.5, speed: 0.19, size: 6, color: "c" as const, phase: 4.2 },
    ];
    let comet = { t: -1, x0: 0, y0: 0, dx: 0, dy: 0 };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (still) draw(0);
    };

    const draw = (ms: number) => {
      const t = ms / 1000;
      ctx.clearRect(0, 0, w, h);
      const cx0 = w * sunX;
      const cy0 = h * sunY;
      const scale = Math.min(w, h * 1.6);

      // stars
      for (const s of stars) {
        ctx.globalAlpha = 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        ctx.fillStyle = pal.ink;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // sun: soft glow that breathes, then a bright core
      const pulse = 1 + 0.06 * Math.sin(t * 1.4);
      const glow = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, scale * 0.16 * pulse);
      glow.addColorStop(0, pal.hi);
      glow.addColorStop(0.35, pal.sun);
      glow.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx0, cy0, scale * 0.16 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.hi;
      ctx.beginPath();
      ctx.arc(cx0, cy0, scale * 0.028, 0, Math.PI * 2);
      ctx.fill();

      // orbits and planets (tilted ellipses)
      const tilt = -0.32;
      for (const p of planets) {
        const rx = scale * p.orbit;
        const ry = rx * 0.38;
        ctx.save();
        ctx.translate(cx0, cy0);
        ctx.rotate(tilt);
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = pal.ink;
        ctx.setLineDash([3, 6]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        const a = p.phase + t * p.speed;
        const x = rx * Math.cos(a);
        const y = ry * Math.sin(a);
        // a short trail behind the planet
        for (let k = 6; k > 0; k--) {
          const b = a - k * 0.06;
          ctx.globalAlpha = 0.05 * (7 - k);
          ctx.fillStyle = pal[p.color];
          ctx.beginPath();
          ctx.arc(rx * Math.cos(b), ry * Math.sin(b), p.size * (1 - k * 0.08), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowColor = pal[p.color];
        ctx.shadowBlur = 14;
        ctx.fillStyle = pal[p.color];
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (p.moon) {
          const m = t * 2.2;
          ctx.fillStyle = pal.ink;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(x + 16 * Math.cos(m), y + 16 * Math.sin(m) * 0.6, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // a comet now and then: streaks across the top, fading out
      if (!still) {
        if (comet.t < 0 && Math.random() < 0.004)
          comet = { t: 0, x0: w * (0.1 + rnd() * 0.5), y0: h * rnd() * 0.3, dx: w * 0.5, dy: h * 0.35 };
        if (comet.t >= 0) {
          comet.t += 1 / 90;
          const k = comet.t;
          const x = comet.x0 + comet.dx * k;
          const y = comet.y0 + comet.dy * k;
          const tail = ctx.createLinearGradient(x, y, x - comet.dx * 0.18, y - comet.dy * 0.18);
          tail.addColorStop(0, pal.hi);
          tail.addColorStop(1, "transparent");
          ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, k));
          ctx.strokeStyle = tail;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - comet.dx * 0.18, y - comet.dy * 0.18);
          ctx.stroke();
          ctx.globalAlpha = 1;
          if (k >= 1) comet.t = -1;
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (ms: number) => {
      draw(ms);
      raf = requestAnimationFrame(loop);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    if (!still) raf = requestAnimationFrame(loop);

    // follow the theme (the user's choice or the system's)
    const repaint = () => {
      pal = readPalette();
      if (still) draw(0);
    };
    const mo = new MutationObserver(repaint);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", repaint);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", repaint);
    };
  }, [sunX, sunY]);

  return <canvas ref={ref} aria-hidden="true" className={cx("block", className)} />;
}
