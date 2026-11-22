"use client";
// The Practice onboarding's background, a <canvas> with one scene per tab (what the tab is about):
//   topics       questions drifting up like bubbles: ?, maths symbols and A B C D choices, joined by thin
//                lines when they pass close, with a ring that pops when one is "answered"
//   programming  a soft rain of code tokens, the head of each column glowing, and a blinking cursor
//   mocks        a big clock dial on the right: ticking second hand, minute sweep, section arcs, pulse rings
// Colours come from the theme tokens and follow light / dark. Decorative only (aria-hidden).
// With reduced motion it draws a single still frame.

import { useEffect, useRef } from "react";
import { cx } from "@/components/utils";
import type { PracticeTab } from "@/lib/practice";

type Palette = Record<"hi" | "a" | "b" | "c" | "ink" | "green", string>;

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback = "#888") => s.getPropertyValue(name).trim() || fallback;
  return {
    hi: v("--hi"),
    a: v("--special-a"),
    b: v("--special-b"),
    c: v("--special-c"),
    ink: v("--ink"),
    green: v("--green", v("--special-a")),
  };
}

type Ctx = CanvasRenderingContext2D;
type Frame = { ctx: Ctx; w: number; h: number; pal: Palette; t: number; still: boolean };
type Scene = (f: Frame) => void;

/** A tiny seeded random, so the layout is the same on every visit (and between server and client). */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SERIF = "Georgia, 'Times New Roman', serif";

// ------------------------------------------------------------------ topics
const SYMBOLS = [
  "?",
  "∫",
  "Σ",
  "π",
  "√",
  "∞",
  "x²",
  "A",
  "B",
  "C",
  "D",
  "%",
  "Δ",
  "λ",
  "θ",
  "≈",
  "∂",
  "P(A)",
  "n!",
  "e",
];

function topicsScene(): Scene {
  const rnd = seeded(11);
  const bubbles = Array.from({ length: 34 }, () => ({
    x: rnd(),
    y: rnd(),
    r: 5 + rnd() * 16,
    speed: 0.012 + rnd() * 0.03, // fraction of the height per second
    sway: 0.01 + rnd() * 0.025,
    phase: rnd() * Math.PI * 2,
    glyph: SYMBOLS[Math.floor(rnd() * SYMBOLS.length)],
    color: (["a", "b", "c", "hi"] as const)[Math.floor(rnd() * 4)],
    pop: rnd() * 9, // when (s, looping every 9) its "answered" ring pops
  }));
  return ({ ctx, w, h, pal, t }) => {
    const pos = bubbles.map((b) => ({
      b,
      x: (b.x + Math.sin(t * 0.4 + b.phase) * b.sway) * w,
      y: ((((b.y - t * b.speed) % 1) + 1) % 1) * (h + 80) - 40,
    }));
    // thin lines between bubbles that pass close
    ctx.lineWidth = 1;
    ctx.strokeStyle = pal.ink;
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d = Math.hypot(dx, dy);
        if (d > 150) continue;
        ctx.globalAlpha = 0.14 * (1 - d / 150);
        ctx.beginPath();
        ctx.moveTo(pos[i].x, pos[i].y);
        ctx.lineTo(pos[j].x, pos[j].y);
        ctx.stroke();
      }
    for (const { b, x, y } of pos) {
      const col = pal[b.color];
      // soft disc
      const g = ctx.createRadialGradient(x, y, 0, x, y, b.r * 2.2);
      g.addColorStop(0, col);
      g.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, b.r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = pal.ink;
      ctx.font = `${Math.round(b.r * 1.05)}px ${b.glyph.length > 1 || /\W/.test(b.glyph) ? SERIF : MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.glyph, x, y + 1);
      // "answered": a ring that pops outward and fades
      const k = (t % 9) - b.pop;
      if (k > 0 && k < 1.1) {
        ctx.globalAlpha = 0.6 * (1 - k / 1.1);
        ctx.strokeStyle = pal.green;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, b.r + k * 26, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  };
}

// ------------------------------------------------------------------ programming
const TOKENS = [
  "{",
  "}",
  "(",
  ")",
  "[",
  "]",
  "=>",
  "==",
  ";",
  "def",
  "for",
  "if",
  "int",
  "0",
  "1",
  "</>",
  "&&",
  "i++",
  "#",
  "//",
  "fn",
  "->",
  "::",
  "'",
  "=",
];

function codeScene(): Scene {
  const rnd = seeded(5);
  const COL = 26; // px between columns
  const cols = Array.from({ length: 80 }, () => ({
    speed: 40 + rnd() * 90, // px per second
    offset: rnd() * 2000,
    len: 8 + Math.floor(rnd() * 12),
    seed: Math.floor(rnd() * 1000),
    color: (["a", "b", "c"] as const)[Math.floor(rnd() * 3)],
  }));
  const LINE = 22;
  return ({ ctx, w, h, pal, t }) => {
    ctx.font = `15px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const n = Math.min(cols.length, Math.ceil(w / COL));
    for (let i = 0; i < n; i++) {
      const c = cols[i];
      const x = i * COL + COL / 2;
      const span = h + c.len * LINE;
      const head = (c.offset + t * c.speed) % span; // y of the brightest glyph
      for (let k = 0; k < c.len; k++) {
        const y = head - k * LINE;
        if (y < -LINE || y > h + LINE) continue;
        const fade = 1 - k / c.len;
        const glyph = TOKENS[(c.seed + k * 7 + Math.floor(t * (k === 0 ? 6 : 0.7))) % TOKENS.length];
        ctx.globalAlpha = 0.5 * fade * fade;
        ctx.fillStyle = k === 0 ? pal.hi : pal[c.color];
        ctx.fillText(glyph, x, y);
      }
    }
    // a blinking cursor, lower right
    const on = Math.floor(t * 1.6) % 2 === 0;
    if (on) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = pal.hi;
      ctx.fillRect(w * 0.8, h * 0.52, 14, 26);
    }
    // a line of "typed" code beside it
    const line = "print(sum(nums))";
    const typed = Math.floor((t * 7) % (line.length + 14));
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = pal.ink;
    ctx.font = `22px ${MONO}`;
    ctx.textAlign = "right";
    ctx.fillText(line.slice(0, Math.min(typed, line.length)), w * 0.8 - 8, h * 0.52 + 14);
    ctx.globalAlpha = 1;
  };
}

// ------------------------------------------------------------------ mocks
function clockScene(): Scene {
  const rnd = seeded(23);
  const stars = Array.from({ length: 70 }, () => ({ x: rnd(), y: rnd(), r: 0.4 + rnd() * 1.1, p: rnd() * 6.28 }));
  return ({ ctx, w, h, pal, t }) => {
    for (const s of stars) {
      ctx.globalAlpha = 0.12 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.2 + s.p));
      ctx.fillStyle = pal.ink;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    const cx0 = w * 0.76;
    const cy0 = h * 0.46;
    const R = Math.min(w * 0.3, h * 0.42, 340);
    ctx.save();
    ctx.translate(cx0, cy0);
    // pulse rings, one per second
    for (let k = 0; k < 3; k++) {
      const p = (t / 3 + k / 3) % 1;
      ctx.globalAlpha = 0.28 * (1 - p);
      ctx.strokeStyle = pal.a;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, R * (1 + p * 0.45), 0, Math.PI * 2);
      ctx.stroke();
    }
    // the dial: outer ring, sixty ticks (every fifth longer)
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const len = i % 5 === 0 ? 16 : 7;
      ctx.globalAlpha = i % 5 === 0 ? 0.55 : 0.25;
      ctx.lineWidth = i % 5 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (R - 4), Math.sin(a) * (R - 4));
      ctx.lineTo(Math.cos(a) * (R - 4 - len), Math.sin(a) * (R - 4 - len));
      ctx.stroke();
    }
    // three section arcs inside the dial, the open one filling up as time passes
    const arcs = [pal.a, pal.b, pal.c];
    const sweep = (t / 24) % 1; // a whole "test" every 24 s
    arcs.forEach((col, i) => {
      const from = -Math.PI / 2 + (i / 3) * Math.PI * 2 + 0.06;
      const to = -Math.PI / 2 + ((i + 1) / 3) * Math.PI * 2 - 0.06;
      const done = Math.min(1, Math.max(0, sweep * 3 - i));
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.78, from, to);
      ctx.stroke();
      if (done > 0) {
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.78, from, from + (to - from) * done);
        ctx.stroke();
      }
    });
    ctx.lineCap = "butt";
    // hands: a smooth minute hand and a second hand that ticks with a little overshoot
    const sec = Math.floor(t);
    const ease = 1 - Math.pow(1 - Math.min(1, (t - sec) * 5), 3);
    const secAngle = ((sec + ease * 0.9) / 60) * Math.PI * 2 - Math.PI / 2;
    const minAngle = (t / 600) * Math.PI * 2 - Math.PI / 2;
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(minAngle) * R * 0.5, Math.sin(minAngle) * R * 0.5);
    ctx.stroke();
    ctx.strokeStyle = pal.hi;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = pal.hi;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(-Math.cos(secAngle) * R * 0.1, -Math.sin(secAngle) * R * 0.1);
    ctx.lineTo(Math.cos(secAngle) * R * 0.66, Math.sin(secAngle) * R * 0.66);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.hi;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
}

const SCENES: Record<PracticeTab, () => Scene> = { topics: topicsScene, programming: codeScene, mocks: clockScene };

/** `kind` = which Practice tab the scene belongs to. Fills its parent; give it `className="absolute inset-0 size-full"`. */
export function PracticeScene({ kind, className }: { kind: PracticeTab; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = SCENES[kind]();
    let pal = readPalette();
    let w = 0;
    let h = 0;
    let raf = 0;

    const draw = (ms: number) => {
      ctx.clearRect(0, 0, w, h);
      scene({ ctx, w, h, pal, t: ms / 1000, still });
    };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (still) draw(4000);
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
      if (still) draw(4000);
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
  }, [kind]);

  return <canvas ref={ref} aria-hidden="true" className={cx("block", className)} />;
}
