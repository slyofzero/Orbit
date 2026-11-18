"use client";
import { useState } from "react";
import type { QuestionMsqRow, QuestionRow } from "@/types/tables";
import { gradeMsq, type Verdict } from "@/lib/grade";
import { QuestionFrame, type FrameResult } from "@/components/question/QuestionFrame";
import { OptionList } from "@/components/question/OptionList";

export function MsqQuestion({
  question,
  detail,
  number,
  onAnswer,
  special,
}: {
  question: QuestionRow;
  detail: QuestionMsqRow;
  number?: number;
  onAnswer?: (v: Verdict) => void;
  special?: boolean;
}) {
  const [picks, setPicks] = useState<number[]>([]);
  const [result, setResult] = useState<FrameResult | null>(null);
  const toggle = (i: number) => setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort()));
  const check = () => {
    const verdict = gradeMsq(detail.correct, picks);
    setResult({ verdict });
    onAnswer?.(verdict);
  };
  return (
    <QuestionFrame
      question={question}
      number={number}
      special={special}
      instruction="Pick every correct option. All of them must be right to score."
      result={result}
      canCheck={picks.length > 0}
      onCheck={check}
      onReset={() => {
        setPicks([]);
        setResult(null);
      }}
    >
      <OptionList
        mode="multi"
        options={detail.options}
        picked={picks}
        correct={result ? detail.correct : null}
        onToggle={toggle}
      />
    </QuestionFrame>
  );
}
