"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/global";
import { cx } from "@/components/utils";

interface AmbientStar {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

const darkStarCount = 400;

/**
 * Bottom background canvas: for subtle ambient drift (floating Greek alphabets & math characters, and test stars).
 */
export function AmbientCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const { isDark } = useTheme();
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  useEffect(() => {
    // Fade in after initial load so main page content appears first
    const timer = setTimeout(() => {
      setVisible(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const starCount = isDark ? 200 : 1000;
    console.log(`Star count - ${starCount}`);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;

    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const stars: AmbientStar[] = Array.from({ length: starCount }, (_, i) => {
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
      ctx.fillStyle = isDarkRef.current ? "#e8eef5" : "#e59b0c";

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

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [isDark]);

  return (
    <canvas
      ref={ref}
      data-layer="ambient"
      aria-hidden="true"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 1200ms ease-out",
      }}
      className={cx("pointer-events-none fixed inset-0 z-0 size-full block", className)}
    />
  );
}
