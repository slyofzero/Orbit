"use client";
// The grid of question numbers beside a sitting: one button per question, coloured by where you are with it,
// the open one outlined. Click a number to jump to that question. Practice states come from lib/session.ts; a
// mock's five exam states (not visited · not answered · answered · marked · answered and marked) from lib/exam.ts.

import { cx, txt } from "@/components/utils";
import type { ExamStatus } from "@/lib/exam";
import type { PaletteState } from "@/lib/session";

type State = PaletteState | ExamStatus;

const BOX: Record<State, string> = {
  new: "border-line bg-sheet text-gray hover:border-ink",
  seen: "border-amber bg-amber-soft text-amber",
  right: "border-green bg-green-soft text-green",
  wrong: "border-red bg-red-soft text-red",
  not_visited: "border-line bg-sheet text-gray hover:border-ink",
  not_answered: "border-red bg-red-soft text-red",
  answered: "border-green bg-green text-white",
  marked: "border-accent bg-accent-soft text-accent",
  answered_marked: "border-accent bg-accent text-on-accent",
};
const LABEL: Record<State, string> = {
  new: "Not opened",
  seen: "Opened, not answered",
  right: "Right",
  wrong: "Wrong",
  not_visited: "Not visited",
  not_answered: "Not answered",
  answered: "Answered",
  marked: "Marked for review",
  answered_marked: "Answered and marked for review (will be marked)",
};
const ORDER: State[] = [
  "new",
  "seen",
  "right",
  "wrong",
  "not_visited",
  "not_answered",
  "answered",
  "marked",
  "answered_marked",
];

/** The little green dot on "answered and marked": it has an answer that will count. */
function Dot() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1 -right-1 size-2.5 rounded-full border-[1.5px] border-sheet bg-green"
    />
  );
}

export function QuestionPalette({
  states,
  current,
  onJump,
  label = "Questions",
  start = 1,
  counts = false,
}: {
  states: State[]; // one per question, in order
  current: number; // index of the open question (-1 = none of these, e.g. it is in another section)
  onJump: (index: number) => void;
  label?: string; // read aloud for the group
  start?: number; // the number shown on the first button (a mock section starts where the last one ended)
  counts?: boolean; // show how many are in each state in the legend (mocks)
}) {
  const present = ORDER.filter((s) => states.includes(s));
  return (
    <div className="grid gap-3">
      <div role="group" aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1.5">
        {states.map((state, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Question ${i + start}: ${LABEL[state]}`}
            aria-current={i === current ? "step" : undefined}
            onClick={() => onJump(i)}
            className={cx(
              "relative grid h-10 cursor-pointer place-items-center rounded-md border-[1.5px] font-display text-[0.85rem] font-bold tabular-nums transition-colors duration-[120ms] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent",
              BOX[state],
              i === current && "outline-2 outline-offset-2 outline-ink",
            )}
          >
            {i + start}
            {state === "answered_marked" && <Dot />}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[0.78rem] text-gray">
        {present.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cx("relative size-3 rounded-[4px] border-[1.5px]", BOX[s].split(" hover:")[0])}
            />
            {txt(counts ? `${states.filter((x) => x === s).length} · ${LABEL[s]}` : LABEL[s])}
          </span>
        ))}
      </div>
    </div>
  );
}
