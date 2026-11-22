"use client";
import type { ReactNode } from "react";
import type { QuestionRow } from "@/types/tables";
import type { Verdict } from "@/lib/grade";
import { Button, Pill, Rich, SparkleBadge } from "@/components/ui";
import { IconCheck, IconPencil, IconRefresh } from "@/components/icons";
import { cx, txt } from "@/components/utils";
import { useEditQuestion } from "@/components/question/editContext";
import { DIFFICULTY_LABEL, DIFFICULTY_TONE, TYPE_LABEL, fmtMarks } from "@/components/question/format";

export type FrameResult = {
  verdict: Verdict; // null = checked with nothing answered
  selfMarked?: boolean; // the learner judged it themselves (code questions)
  detail?: ReactNode; // e.g. "Correct answer: 3.14"
  marks?: number | null; // a mock review: the marks it earned; null = not marked automatically (code)
};

/** Wrapper for a typed answer (nat / str): after checking, its input turns green (right) or red (wrong). */
export function typedClass(verdict: Verdict | undefined): string {
  return cx(
    "max-w-80",
    verdict === "correct" && "[&_input]:border-green [&_input]:bg-green-soft",
    verdict === "incorrect" && "[&_input]:border-red [&_input]:bg-red-soft",
  );
}

/** The shell every question type shares: meta row, stem, answer area, check / try-again, verdict, explanation.
 *  `exam` drops checking (a mock in progress); a `result` without `onReset` is locked (a mock review). */
export function QuestionFrame({
  question,
  number,
  instruction,
  children,
  result,
  canCheck,
  onCheck,
  onReset,
  actions,
  special = false,
  split = false,
  exam = false,
}: {
  question: QuestionRow;
  number?: number; // shows "Q3"
  instruction: ReactNode; // what to do, e.g. "Pick one option"
  children: ReactNode; // the answer area
  result: FrameResult | null; // null = not checked yet
  canCheck: boolean;
  onCheck: () => void;
  onReset?: () => void; // Try again; leave out to lock the result (a mock review)
  actions?: ReactNode; // replaces the Check button (code questions)
  special?: boolean; // animated gradient border + sparkle (e.g. question of the day)
  split?: boolean; // wide screens: the stem on the left, the answer area and verdict on the right (code questions)
  exam?: boolean; // a mock in progress: no Check button and no verdict, just the instruction under the answer
}) {
  const q = question;
  const edit = useEditQuestion();
  const stem = <Rich text={q.stem} block className="text-[1.08rem] leading-[1.65]" />;
  const answer = <div className="grid gap-2.5">{children}</div>;
  const footer = exam ? (
    <span className="text-[0.85rem] text-gray">{txt(instruction)}</span>
  ) : result ? (
    <>
      {q.explanation && (
        <div className="grid gap-1.5 rounded-md bg-sheet-2 px-4 py-3">
          <span className="text-[0.9rem] font-bold text-gray">Explanation</span>
          <Rich text={q.explanation} block />
        </div>
      )}
      <VerdictBox q={q} result={result} onReset={onReset} />
    </>
  ) : (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="mr-auto text-[0.85rem] text-gray">{txt(instruction)}</span>
      {actions ?? (
        <Button variant="primary" icon={<IconCheck />} disabled={!canCheck} onClick={onCheck}>
          Check answer
        </Button>
      )}
    </div>
  );

  return (
    <article
      aria-label={number ? `Question ${number}` : "Question"}
      className={cx(
        "grid gap-4 rounded-[20px] px-[22px] py-5",
        special
          ? "special-border animate-flow-border border-2 shadow-[0_14px_34px_-22px_var(--special-c)]"
          : "border border-line bg-sheet",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {special && <SparkleBadge />}
        {number !== undefined && <Pill tone="ink">Q{number}</Pill>}
        <Pill tone="blue">{TYPE_LABEL[q.type]}</Pill>
        <Pill tone={DIFFICULTY_TONE[q.difficulty]}>{DIFFICULTY_LABEL[q.difficulty]}</Pill>
        {edit && !exam && (
          <Button variant="ghost" size="sm" icon={<IconPencil />} onClick={() => edit(q.id)}>
            Edit
          </Button>
        )}
        <span className="ml-auto inline-flex gap-2.5 text-[0.85rem] font-bold">
          <span className="text-green">
            +{fmtMarks(q.marks)} {q.marks === 1 ? "mark" : "marks"}
          </span>
          {q.negative_marks > 0 ? (
            <span className="text-red">−{fmtMarks(q.negative_marks)} if wrong</span>
          ) : (
            <span className="font-semibold text-gray">No negative marking</span>
          )}
        </span>
      </div>

      {split ? (
        <div className="grid items-start gap-5 min-[1100px]:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className="min-[1100px]:sticky min-[1100px]:top-6">{stem}</div>
          <div className="grid gap-4">
            {answer}
            {footer}
          </div>
        </div>
      ) : (
        <>
          {stem}
          {answer}
          {footer}
        </>
      )}
    </article>
  );
}

/** The verdict bar (right / wrong / not answered, marks, any detail) with Try again at its right end. */
function VerdictBox({ q, result, onReset }: { q: QuestionRow; result: FrameResult; onReset?: () => void }) {
  const { verdict, selfMarked, detail, marks } = result;
  const by = selfMarked ? " (marked by you)" : "";
  const title =
    marks === null
      ? "Not marked automatically · 0"
      : verdict === "correct"
        ? `✓ Correct · +${fmtMarks(q.marks)}${by}`
        : verdict === "incorrect"
          ? `✗ Incorrect · ${q.negative_marks > 0 ? `−${fmtMarks(q.negative_marks)}` : "no marks lost"}${by}`
          : "Not answered · 0";
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-md border-l-4 py-2.5 pr-2.5 pl-4",
        marks !== null && verdict === "correct"
          ? "border-green bg-green-soft"
          : marks !== null && verdict === "incorrect"
            ? "border-red bg-red-soft"
            : "border-gray bg-sheet-2",
      )}
    >
      <div role="status" className="grid min-w-0 flex-1 gap-1.5">
        <span
          className={cx(
            "flex items-center gap-2 font-bold",
            marks !== null && verdict === "correct" && "text-green",
            marks !== null && verdict === "incorrect" && "text-red",
          )}
        >
          {title}
        </span>
        {detail && <div>{txt(detail)}</div>}
      </div>
      {onReset && (
        <Button variant="soft" icon={<IconRefresh />} onClick={onReset}>
          Try again
        </Button>
      )}
    </div>
  );
}
