"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/components/utils";

interface AmbientStar {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

/**
 * Bottom background canvas: for subtle ambient drift (floating Greek alphabets & math characters, and test stars).
 */
export function AmbientCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;

    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const stars: AmbientStar[] = Array.from({ length: 200 }, (_, i) => {
      const isRail = i < 22; // dedicated stars in the left sidebar lane
      const isLarge = rnd() > 0.8;
      return {
        x: isRail ? rnd() * 0.055 : rnd(),
        y: rnd(),
        r: isLarge ? 1.8 + rnd() * 1.2 : 0.8 + rnd() * 1.0,
        phase: rnd() * Math.PI * 2,
        speed: 0.6 + rnd() * 1.6,
      };
    });

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (still) draw(0);
    };

    const draw = (ms: number) => {
      const t = ms / 1000;
      ctx.clearRect(0, 0, w, h);
      const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#fff";
      ctx.fillStyle = ink;

      for (const s of stars) {
        const pulse = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
        const alpha = 0.35 + 0.65 * pulse;
        const sx = s.x * w;
        const sy = s.y * h;

        if (s.r > 1.8) {
          ctx.globalAlpha = alpha * 0.28;
          ctx.beginPath();
          ctx.arc(sx, sy, s.r * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (ms: number) => {
      draw(ms);
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);

    if (!still) {
      raf = requestAnimationFrame(loop);
    }

    const repaint = () => {
      if (still) draw(0);
    };
    const mo = new MutationObserver(repaint);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", repaint);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      mo.disconnect();
      mq.removeEventListener("change", repaint);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      data-layer="ambient"
      aria-hidden="true"
      className={cx("pointer-events-none fixed inset-0 -z-20 size-full block", className)}
    />
  );
}
