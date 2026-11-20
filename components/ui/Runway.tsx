"use client";
// v1's dashboard hero ("runway"): a dark panel with a big headline, a line under it, stat chips on
// the right, and a track of one tick per day with milestone flags hanging under it.
// What goes in it (which day is done, where flags sit) is worked out by the caller (lib/runway.ts).

import { useEffect, useState, type ReactNode } from "react";
import { cx, txt } from "@/components/utils";

export type RunwayTick = "done" | "miss" | "past" | "today" | "ms" | "future";
export interface RunwayFlag {
  key: string | number;
  name: string;
  pct: number; // 0–100 along the track
  long: string; // e.g. "15 days to go"
  short: string; // e.g. "15d" (phones)
  next?: boolean; // highlighted, with a ping
  flip?: boolean; // label hangs to the left (near the right end)
  level?: 0 | 1; // phones: alternate rows so neighbours don't overlap
}

// heights: desktop / phone (v1 used a shorter track on desktop)
const TICK: Record<RunwayTick, string> = {
  future: "h-[14px] bg-white/20 max-[760px]:h-[22px]",
  past: "h-4 bg-on-hero/35 max-[760px]:h-[26px]",
  done: "h-[18px] bg-green max-[760px]:h-[30px]",
  miss: "h-[18px] bg-red max-[760px]:h-[30px]",
  today: "h-8 bg-hi shadow-[0_0_14px_var(--hi)] max-[760px]:h-[54px]",
  ms: "h-8 bg-white max-[760px]:h-[54px]",
};

export function Runway({
  title,
  sub,
  stats,
  ticks,
  flags = [],
  label,
}: {
  title: ReactNode;
  sub?: ReactNode;
  stats?: ReactNode; // e.g. <RunwayStat …/> chips
  ticks: { key: string; state: RunwayTick; title?: string }[]; // empty = no track
  flags?: RunwayFlag[];
  label: string; // what the track shows, for screen readers
}) {
  return (
    <section
      aria-label={label}
      className="relative mb-[18px] overflow-hidden rounded-[22px] border border-line bg-hero/84 px-[26px] pt-[18px] pb-3.5 text-on-hero max-[760px]:mb-[26px] max-[760px]:rounded-[28px] max-[760px]:p-[clamp(22px,3vw,36px)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 max-[760px]:gap-7 max-[560px]:gap-4">
        <div>
          <h1 className="font-display text-[clamp(1.5rem,2.7vw,2.3rem)] leading-[1.02] font-extrabold tracking-[-0.03em] text-on-hero max-[760px]:text-[clamp(2.2rem,5.2vw,3.9rem)]">
            {txt(title)}
          </h1>
          {sub && (
            <p className="mt-1.5 max-w-[60ch] text-[0.92rem] text-on-hero/70 max-[760px]:mt-3.5 max-[760px]:text-[1.02rem]">
              {txt(sub)}
            </p>
          )}
        </div>
        {stats && (
          <div className="flex flex-wrap gap-3.5 max-[560px]:w-full max-[560px]:flex-nowrap max-[560px]:gap-2">
            {stats}
          </div>
        )}
      </div>

      {ticks.length > 0 && (
        <div className="relative mt-3 pb-14 max-[760px]:mt-[30px] max-[760px]:pb-[130px]">
          <div className="flex h-8 items-end gap-[2px] max-[760px]:h-[54px]" aria-hidden="true">
            {ticks.map((t, i) => (
              <i
                key={t.key}
                title={t.title}
                className={cx(
                  "min-w-[2px] flex-1 origin-bottom rounded-[2px]",
                  TICK[t.state],
                  t.state === "today" ? "animate-breathe" : "animate-tick-grow",
                )}
                style={t.state === "today" ? undefined : { animationDelay: `${i * 7}ms` }}
              />
            ))}
          </div>
          {flags.map((f) => (
            <div
              key={f.key}
              style={{ left: `${f.pct}%` }}
              className={cx(
                "absolute top-9 flex min-w-[112px] flex-col gap-0.5 border-white max-[760px]:min-w-0",
                f.flip
                  ? "ml-[2px] -translate-x-full items-end border-r-2 pr-2.5 text-right max-[760px]:pr-2"
                  : "border-l-2 pl-2.5 max-[760px]:pl-2",
                f.level === 1
                  ? "max-[760px]:top-[112px] max-[760px]:before:absolute max-[760px]:before:-top-[54px] max-[760px]:before:h-[54px] max-[760px]:before:w-[2px] max-[760px]:before:bg-white"
                  : "max-[760px]:top-[58px]",
                f.level === 1 && (f.flip ? "max-[760px]:before:-right-[2px]" : "max-[760px]:before:-left-[2px]"),
              )}
            >
              <b
                className={cx(
                  "font-display text-[0.98rem] leading-[1.1]",
                  f.next && "inline-flex w-fit items-center rounded px-1.5 bg-hi text-black",
                )}
              >
                {txt(f.name)}
                {f.next && (
                  <span
                    aria-hidden="true"
                    className="ml-[7px] inline-block size-[7px] animate-flag-ping rounded-full bg-red"
                  />
                )}
              </b>
              <span className="text-[0.78rem] text-on-hero/70 max-[760px]:hidden">{txt(f.long)}</span>
              <span className="hidden text-[0.84rem] text-on-hero/70 max-[760px]:inline">{txt(f.short)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** A chip in the runway's top right: something visual (a ring, the flame), a big value, a small label. */
export function RunwayStat({
  visual,
  value,
  label,
  title,
}: {
  visual: ReactNode;
  value: ReactNode;
  label: ReactNode;
  title?: string;
}) {
  return (
    <div
      title={title}
      className="flex items-center gap-2.5 rounded-2xl border border-white/12 bg-white/7 py-2 pr-3.5 pl-2.5 max-[760px]:gap-3 max-[760px]:rounded-[20px] max-[760px]:py-3 max-[760px]:pr-[18px] max-[760px]:pl-3 max-[560px]:flex-1 max-[560px]:gap-2 max-[560px]:rounded-2xl max-[560px]:py-2 max-[560px]:pr-2.5 max-[560px]:pl-2"
    >
      {visual}
      <div>
        <b className="block font-display text-[1.2rem] leading-none font-extrabold tabular-nums max-[760px]:text-[1.5rem] max-[560px]:text-[1.15rem]">
          {txt(value)}
        </b>
        <small className="text-[0.78rem] text-on-hero/70">{txt(label)}</small>
      </div>
    </div>
  );
}

/** v1's streak flame: lit and flickering when `on`, grey otherwise. */
export function Flame({
  on,
  className = "size-[30px] max-[760px]:size-10 max-[560px]:size-[30px]",
}: {
  on: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cx("flex-none", on && "origin-[50%_90%] animate-flicker", className)}
    >
      <path
        className={on ? "fill-warm-c" : "fill-white/30"}
        d="M20 3c1 6 9 10 9 20a9 9 0 01-18 0c0-4 2-6 3-8 1 3 3 4 4 4-1-6 0-12 2-16z"
      />
      <path
        className={on ? "fill-hi" : "fill-white/20"}
        d="M20 20c1 3 5 4 5 8a5 5 0 01-10 0c0-2 1-3 2-4 1 1 2 1 2 1-.5-2-.5-4 1-5z"
      />
    </svg>
  );
}

/** A number that counts up to `n` once (v1's countdown). Honours reduced motion. */
export function CountUp({ n }: { n: number }) {
  const [v, setV] = useState(n);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || n <= 0) return setV(n);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setV(Math.round(n * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    setV(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <span className="text-hi tabular-nums">{v}</span>;
}
