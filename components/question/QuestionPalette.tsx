"use client";
// The grid of question numbers beside a sitting: one button per question, coloured by where you are with it,
// the open one outlined. Click a number to jump to that question. The states come from lib/session.ts.

import { cx, txt } from "@/components/utils";
import type { PaletteState } from "@/lib/session";

const BOX: Record<PaletteState, string> = {
  new: "border-line bg-sheet text-gray hover:border-ink",
  seen: "border-amber bg-amber-soft text-amber",
  right: "border-green bg-green-soft text-green",
  wrong: "border-red bg-red-soft text-red",
};
const LABEL: Record<PaletteState, string> = {
  new: "Not opened",
  seen: "Opened, not answered",
  right: "Right",
  wrong: "Wrong",
};
const ORDER: PaletteState[] = ["new", "seen", "right", "wrong"];

export function QuestionPalette({
  states,
  current,
  onJump,
  label = "Questions",
}: {
  states: PaletteState[]; // one per question, in order
  current: number; // index of the open question
  onJump: (index: number) => void;
  label?: string; // read aloud for the group
}) {
  const present = ORDER.filter((s) => states.includes(s));
  return (
    <div className="grid gap-3">
      <div role="group" aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1.5">
        {states.map((state, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Question ${i + 1}: ${LABEL[state]}`}
            aria-current={i === current ? "step" : undefined}
            onClick={() => onJump(i)}
            className={cx(
              "grid h-10 cursor-pointer place-items-center rounded-md border-[1.5px] font-display text-[0.85rem] font-bold tabular-nums transition-colors duration-[120ms] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent",
              BOX[state],
              i === current && "outline-2 outline-offset-2 outline-ink",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[0.78rem] text-gray">
        {present.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cx("size-3 rounded-[4px] border-[1.5px]", BOX[s].split(" hover:")[0])}
            />
            {txt(LABEL[s])}
          </span>
        ))}
      </div>
    </div>
  );
}
