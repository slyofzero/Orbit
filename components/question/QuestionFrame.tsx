"use client";
import type { ReactNode } from "react";
import type { QuestionRow } from "@/types/tables";
import type { Verdict } from "@/lib/grade";
import { Button, Pill, Rich, SparkleBadge } from "@/components/ui";
import { IconCheck, IconRefresh } from "@/components/icons";
import { cx, txt } from "@/components/utils";
import { DIFFICULTY_LABEL, DIFFICULTY_TONE, TYPE_LABEL, fmtMarks } from "@/components/question/format";

export type FrameResult = {
  verdict: Verdict; // null = checked with nothing answered
  selfMarked?: boolean; // the learner judged it themselves (code questions)
  detail?: ReactNode; // e.g. "Correct answer: 3.14"
};

/** Wrapper for a typed answer (nat / str): after checking, its input turns green (right) or red (wrong). */
export function typedClass(verdict: Verdict | undefined): string {
  return cx(
    "max-w-80",
    verdict === "correct" && "[&_input]:border-green [&_input]:bg-green-soft",
    verdict === "incorrect" && "[&_input]:border-red [&_input]:bg-red-soft",
  );
}

/** The shell every question type shares: meta row, stem, answer area, check / try-again, verdict, explanation. */
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
}: {
  question: QuestionRow;
  number?: number; // shows "Q3"
  instruction: ReactNode; // what to do, e.g. "Pick one option"
  children: ReactNode; // the answer area
  result: FrameResult | null; // null = not checked yet
  canCheck: boolean;
  onCheck: () => void;
  onReset: () => void;
  actions?: ReactNode; // replaces the Check button (code questions)
  special?: boolean; // animated gradient border + sparkle (e.g. question of the day)
}) {
  const q = question;
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

      <Rich text={q.stem} block className="text-[1.08rem] leading-[1.65]" />

      <div className="grid gap-2.5">{children}</div>

      {result ? (
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
      )}
    </article>
  );
}

/** The verdict bar (right / wrong / not answered, marks, any detail) with Try again at its right end. */
function VerdictBox({ q, result, onReset }: { q: QuestionRow; result: FrameResult; onReset: () => void }) {
  const { verdict, selfMarked, detail } = result;
  const by = selfMarked ? " (marked by you)" : "";
  const title =
    verdict === "correct"
      ? `✓ Correct · +${fmtMarks(q.marks)}${by}`
      : verdict === "incorrect"
        ? `✗ Incorrect · ${q.negative_marks > 0 ? `−${fmtMarks(q.negative_marks)}` : "no marks lost"}${by}`
        : "Not answered · 0";
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-md border-l-4 py-2.5 pr-2.5 pl-4",
        verdict === "correct"
          ? "border-green bg-green-soft"
          : verdict === "incorrect"
            ? "border-red bg-red-soft"
            : "border-gray bg-sheet-2",
      )}
    >
      <div role="status" className="grid min-w-0 flex-1 gap-1.5">
        <span
          className={cx(
            "flex items-center gap-2 font-bold",
            verdict === "correct" && "text-green",
            verdict === "incorrect" && "text-red",
          )}
        >
          {title}
        </span>
        {detail && <div>{txt(detail)}</div>}
      </div>
      <Button variant="soft" icon={<IconRefresh />} onClick={onReset}>
        Try again
      </Button>
    </div>
  );
}
