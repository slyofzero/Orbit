"use client";
import { useId } from "react";
import { Rich, cx } from "@/components/ui";
import { letter } from "./format";

/** The A/B/C/D choices of an mcq (single) or msq (multi) question.
 *  Before checking: picked options are blue. After checking (`correct` given): correct options turn
 *  green, wrong picks turn red, and everything is locked. */
export function OptionList({ mode, options, picked, correct, onToggle }: {
  mode: "single" | "multi";
  options: string[];
  picked: number[];
  correct: number[] | null;       // null = not revealed yet
  onToggle: (index: number) => void;
}) {
  const name = useId();
  const locked = correct !== null;
  return (
    <fieldset className={cx("qz-opts", locked && "is-locked")} data-mode={mode}>
      <legend className="ui-sr">{mode === "single" ? "Pick one option" : "Pick every correct option"}</legend>
      {options.map((text, i) => {
        const isPicked = picked.includes(i);
        const isRight = locked && correct.includes(i);
        const isWrong = locked && isPicked && !correct.includes(i);
        const tag = isRight ? (isPicked ? "Your answer ✓" : "Correct answer") : isWrong ? "Your answer" : null;
        return (
          <label key={i} className={cx("qz-opt", !locked && isPicked && "is-picked", isRight && "is-right", isWrong && "is-wrong")}>
            <input
              type={mode === "single" ? "radio" : "checkbox"}
              name={name}
              checked={isPicked}
              disabled={locked}
              onChange={() => onToggle(i)}
            />
            <span className="qz-letter" aria-hidden="true">{letter(i)}</span>
            <span className="qz-opt-body"><span className="ui-sr">Option {letter(i)}: </span><Rich text={text} /></span>
            {tag && <span className="qz-opt-tag">{tag}</span>}
          </label>
        );
      })}
    </fieldset>
  );
}
