"use client";
import type { ReactNode } from "react";
import type { QuestionRow } from "@/types/tables";
import type { Verdict } from "@/lib/grade";
import { Button, Pill, Rich, SparkleBadge, IconCheck, IconRefresh, cx, txt } from "@/components/ui";
import { DIFFICULTY_LABEL, DIFFICULTY_TONE, TYPE_LABEL, fmtMarks } from "./format";

export type FrameResult = {
  verdict: Verdict;          // null = checked with nothing answered
  selfMarked?: boolean;      // the learner judged it themselves (code questions)
  detail?: ReactNode;        // e.g. "Correct answer: 3.14"
};

/** The shell every question type shares: meta row, stem, answer area, check / try-again, verdict, explanation. */
export function QuestionFrame({ question, number, instruction, children, result, canCheck, onCheck, onReset, actions, special = false }: {
  question: QuestionRow;
  number?: number;                   // shows "Q3"
  instruction: ReactNode;            // what to do, e.g. "Pick one option"
  children: ReactNode;               // the answer area
  result: FrameResult | null;        // null = not checked yet
  canCheck: boolean;
  onCheck: () => void;
  onReset: () => void;
  actions?: ReactNode;               // replaces the Check button (code questions)
  special?: boolean;                 // animated gradient border + sparkle (e.g. question of the day)
}) {
  const q = question;
  return (
    <article className={cx("qz", special && "is-special")} aria-label={number ? `Question ${number}` : "Question"}>
      <div className="qz-meta">
        {special && <SparkleBadge />}
        {number !== undefined && <Pill tone="ink">Q{number}</Pill>}
        <Pill tone="blue">{TYPE_LABEL[q.type]}</Pill>
        <Pill tone={DIFFICULTY_TONE[q.difficulty]}>{DIFFICULTY_LABEL[q.difficulty]}</Pill>
        <span className="qz-marks">
          <span className="qz-plus">+{fmtMarks(q.marks)} {q.marks === 1 ? "mark" : "marks"}</span>
          {q.negative_marks > 0
            ? <span className="qz-minus">−{fmtMarks(q.negative_marks)} if wrong</span>
            : <span className="qz-nominus">No negative marking</span>}
        </span>
      </div>

      <Rich text={q.stem} block className="qz-stem" />

      <div className="qz-answer">{children}</div>

      {result ? <VerdictBox q={q} result={result} /> : null}

      <div className="qz-foot">
        <span className="qz-instr">{result ? "" : txt(instruction)}</span>
        {result ? (
          <Button variant="soft" icon={<IconRefresh />} onClick={onReset}>Try again</Button>
        ) : actions ?? (
          <Button variant="primary" icon={<IconCheck />} disabled={!canCheck} onClick={onCheck}>Check answer</Button>
        )}
      </div>

      {result && q.explanation && (
        <div className="qz-expl">
          <span className="qz-expl-title">Explanation</span>
          <Rich text={q.explanation} block />
        </div>
      )}
    </article>
  );
}

function VerdictBox({ q, result }: { q: QuestionRow; result: FrameResult }) {
  const { verdict, selfMarked, detail } = result;
  const by = selfMarked ? " (marked by you)" : "";
  const title =
    verdict === "correct" ? `✓ Correct · +${fmtMarks(q.marks)}${by}`
    : verdict === "incorrect"
      ? `✗ Incorrect · ${q.negative_marks > 0 ? `−${fmtMarks(q.negative_marks)}` : "no marks lost"}${by}`
      : "Not answered · 0";
  return (
    <div className={cx("qz-verdict", verdict === "correct" ? "is-right" : verdict === "incorrect" ? "is-wrong" : "is-self")} role="status">
      <span className="qz-verdict-title">{title}</span>
      {detail && <div>{txt(detail)}</div>}
    </div>
  );
}
