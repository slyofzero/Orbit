"use client";
// The short "loaded!" transition after questions or mocks are imported, whatever their type: the screen
// frosts over, a tick pops in with rings and confetti, the counts rise, then it dissolves into the tab that
// is now filled. It lives in the Practice page (not the onboarding it was started from), because the
// onboarding disappears the moment the first question lands. Calls `onDone` when it is over.
// With reduced motion it shows nothing and finishes at once. Animations: styles/animations/import-celebration.css.

import { useEffect, useRef, type CSSProperties } from "react";
import { cx, txt } from "@/components/utils";

export const CELEBRATE_MS = 1800;

/** What was just loaded (the numbers `pack.import` returned, added up over every file). */
export interface Celebration {
  questions: number;
  mocks: number;
}

const PIECES: { dx: number; dy: number; rot: number; tone: string }[] = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
  const d = 150 + (i % 3) * 45;
  return {
    dx: Math.round(Math.cos(a) * d),
    dy: Math.round(Math.sin(a) * d),
    rot: (i % 2 ? 1 : -1) * (180 + i * 23),
    tone: ["bg-accent", "bg-green", "bg-hi", "bg-amber", "bg-red", "bg-blue"][i % 6],
  };
});

const plural = (n: number, one: string, many = `${one}s`) => `**${n}** ${n === 1 ? one : many}`;

export function ImportCelebration({
  summary,
  onDone,
  duration = CELEBRATE_MS,
}: {
  summary: Celebration;
  onDone?: () => void;
  duration?: number; // ms
}) {
  const done = useRef(onDone);
  done.current = onDone;
  const still = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (still) return void done.current?.();
    const t = window.setTimeout(() => done.current?.(), duration);
    return () => clearTimeout(t);
  }, [still, duration]);

  if (still) return null;

  const parts = [
    summary.questions > 0 && plural(summary.questions, "question"),
    summary.mocks > 0 && plural(summary.mocks, "mock test"),
  ].filter(Boolean);

  return (
    <div
      role="status"
      aria-live="polite"
      // --celebrate-ms drives every timing in styles/animations/import-celebration.css
      style={{ "--celebrate-ms": `${duration}ms` } as CSSProperties}
      className="fixed inset-0 z-[100] grid animate-celebrate-out place-items-center overflow-hidden"
    >
      <div aria-hidden="true" className="frosted absolute inset-0 animate-celebrate-in bg-pad/70" />
      <div className="relative grid place-items-center gap-5 px-6 text-center">
        <div className="relative grid size-28 place-items-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-celebrate-ring rounded-full border-[3px] border-accent"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-celebrate-ring-late rounded-full border-[3px] border-green"
          />
          {PIECES.map((p, i) => (
            <span
              key={i}
              aria-hidden="true"
              style={{ "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.rot}deg` } as CSSProperties}
              className={cx("absolute size-2.5 animate-celebrate-piece rounded-[3px]", p.tone)}
            />
          ))}
          <span className="special-fill grid size-24 animate-celebrate-tick place-items-center rounded-full text-5xl text-white shadow-lg">
            ✓
          </span>
        </div>
        <div className="grid animate-celebrate-text justify-items-center gap-1">
          <span className="font-display text-sm font-bold tracking-[0.12em] text-gray uppercase">Loaded</span>
          <span className="special-text animate-flow font-display text-[clamp(1.6rem,4vw,2.6rem)] leading-tight font-extrabold">
            {txt(parts.join(" and ") || "Your file")}
          </span>
        </div>
      </div>
    </div>
  );
}
