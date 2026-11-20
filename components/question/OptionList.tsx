"use client";
import { useId } from "react";
import { Rich } from "@/components/ui";
import { cx } from "@/components/utils";
import { letter } from "@/components/question/format";

type Tone = "picked" | "right" | "wrong";
const BOX: Record<Tone, string> = {
  picked: "border-blue bg-blue-soft",
  right: "border-green bg-green-soft",
  wrong: "border-red bg-red-soft",
};
const LETTER: Record<Tone, string> = {
  picked: "border-blue bg-blue text-white",
  right: "border-green bg-green text-white",
  wrong: "border-red bg-red text-white",
};

/** The A/B/C/D choices of an mcq (single) or msq (multi) question.
 *  Before checking: picked options are blue. After checking (`correct` given): correct options turn
 *  green, wrong picks turn red, and everything is locked. */
export function OptionList({
  mode,
  options,
  picked,
  correct,
  onToggle,
}: {
  mode: "single" | "multi";
  options: string[];
  picked: number[];
  correct: number[] | null; // null = not revealed yet
  onToggle: (index: number) => void;
}) {
  const name = useId();
  const locked = correct !== null;
  return (
    <fieldset className="m-0 grid gap-2 border-0 p-0">
      <legend className="sr-only">{mode === "single" ? "Pick one option" : "Pick every correct option"}</legend>
      {options.map((text, i) => {
        const isPicked = picked.includes(i);
        const isRight = locked && correct.includes(i);
        const isWrong = locked && isPicked && !correct.includes(i);
        const tone: Tone | null = isRight ? "right" : isWrong ? "wrong" : !locked && isPicked ? "picked" : null;
        const tag = isRight ? (isPicked ? "Your answer ✓" : "Correct answer") : isWrong ? "Your answer" : null;
        return (
          <label
            key={i}
            className={cx(
              "relative flex items-start gap-3 rounded-md border-[1.5px] px-3.5 py-[11px] transition-[border-color,background-color] duration-[120ms] focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-accent",
              locked ? "cursor-default" : "cursor-pointer",
              tone ? BOX[tone] : "border-line bg-sheet hover:border-ink",
            )}
          >
            <input
              type={mode === "single" ? "radio" : "checkbox"}
              name={name}
              checked={isPicked}
              disabled={locked}
              onChange={() => onToggle(i)}
              className="pointer-events-none absolute opacity-0"
            />
            <span
              aria-hidden="true"
              className={cx(
                "grid size-7 shrink-0 place-items-center border-[1.5px] font-display text-[0.85rem] font-bold",
                mode === "single" ? "rounded-full" : "rounded-[7px]",
                tone ? LETTER[tone] : "border-line bg-sheet text-gray",
              )}
            >
              {letter(i)}
            </span>
            <span className="min-w-0 flex-1 pt-0.5">
              <span className="sr-only">Option {letter(i)}: </span>
              <Rich text={text} />
            </span>
            {tag && (
              <span
                className={cx(
                  "ml-auto self-center text-[0.78rem] font-bold whitespace-nowrap",
                  isRight ? "text-green" : "text-red",
                )}
              >
                {tag}
              </span>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}
