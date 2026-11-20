"use client";
// The launch sequence shown once after a plan is imported: stars streak outward from the centre
// (a canvas "hyperspace" warp), the rocket lifts off, the title fades up, and the whole overlay then
// dissolves into the dashboard underneath. Calls `onDone` when it's over.
// `duration` (ms) scales every part of it. `duration={Infinity}` keeps it on screen for good (dev:
// tweaking the look): the warp holds at full speed and the rocket keeps launching on a loop.
// With reduced motion it shows nothing and finishes at once.

import { useEffect, useRef, type CSSProperties } from "react";
import { cx, txt } from "@/components/utils";

export const LAUNCH_MS = 1500;
const LOOP_MS = 1500; // one rocket launch per loop when the sequence is permanent

export function LaunchWarp({
  title,
  onDone,
  duration = LAUNCH_MS,
}: {
  title: string;
  onDone?: () => void;
  duration?: number; // ms; Infinity = stays until removed
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const still = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const forever = !Number.isFinite(duration);
  const ms = forever ? LOOP_MS : Math.max(200, duration);

  useEffect(() => {
    if (still) return void done.current?.();
    const t = forever ? 0 : window.setTimeout(() => done.current?.(), ms);
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return () => clearTimeout(t);

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = innerWidth;
    const h = innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const colours = ["--ink", "--accent", "--special-b", "--special-c", "--hi"].map((v) =>
      css.getPropertyValue(v).trim(),
    );
    const stars = Array.from({ length: 240 }, () => ({
      a: Math.random() * Math.PI * 2,
      d: 4 + Math.random() * 60, // distance from the centre
      v: 0.6 + Math.random() * 1.4,
      c: colours[Math.floor(Math.random() * colours.length)],
    }));
    const ramp = ms * 0.73; // the warp reaches full speed as the rocket leaves (same share as the CSS)
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const k = Math.min(1, (now - t0) / ramp); // 0 → 1, then stays at full speed
      const speed = 2 + 38 * k * k; // accelerate
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const d0 = s.d;
        s.d += s.v * speed;
        const len = Math.min(s.d - d0, 140) + 1;
        const x1 = w / 2 + Math.cos(s.a) * (s.d - len);
        const y1 = h / 2 + Math.sin(s.a) * (s.d - len);
        const x2 = w / 2 + Math.cos(s.a) * s.d;
        const y2 = h / 2 + Math.sin(s.a) * s.d;
        ctx.globalAlpha = Math.min(1, 0.25 + k);
        ctx.strokeStyle = s.c;
        ctx.lineWidth = 1 + k * 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (s.d > Math.hypot(w, h) / 2) s.d = 4 + Math.random() * 30; // start again near the centre
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [still, forever, ms]);

  if (still) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      // --launch-ms drives every timing in styles/animations/launch.css
      style={{ "--launch-ms": `${ms}ms` } as CSSProperties}
      className={cx(
        "fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-pad",
        !forever && "animate-launch-out",
      )}
    >
      <canvas ref={ref} aria-hidden="true" className="absolute inset-0 size-full" />
      <span
        aria-hidden="true"
        className={cx("absolute text-7xl animate-launch-rocket", forever && "[animation-iteration-count:infinite]")}
      >
        🚀
      </span>
      <div className="relative grid animate-launch-title justify-items-center gap-1 px-6 text-center">
        <span className="font-display text-sm font-bold tracking-[0.12em] text-gray uppercase">Launching</span>
        <span className="special-text animate-flow font-display text-[clamp(1.8rem,4vw,3rem)] leading-tight font-extrabold">
          {txt(title)}
        </span>
      </div>
    </div>
  );
}
