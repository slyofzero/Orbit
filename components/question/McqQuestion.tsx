"use client";
import { useState } from "react";
import type { QuestionMcqRow, QuestionRow } from "@/types/tables";
import { gradeMcq, type Verdict } from "@/lib/grade";
import { QuestionFrame, type FrameResult } from "@/components/question/QuestionFrame";
import { OptionList } from "@/components/question/OptionList";

export function McqQuestion({
  question,
  detail,
  number,
  onAnswer,
  special,
}: {
  question: QuestionRow;
  detail: QuestionMcqRow;
  number?: number;
  onAnswer?: (v: Verdict) => void;
  special?: boolean;
}) {
  const [pick, setPick] = useState<number | null>(null);
  const [result, setResult] = useState<FrameResult | null>(null);
  const check = () => {
    const verdict = gradeMcq(detail.correct, pick);
    setResult({ verdict });
    onAnswer?.(verdict);
  };
  return (
    <QuestionFrame
      question={question}
      number={number}
      special={special}
      instruction="Pick one option."
      result={result}
      canCheck={pick !== null}
      onCheck={check}
      onReset={() => {
        setPick(null);
        setResult(null);
      }}
    >
      <OptionList
        mode="single"
        options={detail.options}
        picked={pick === null ? [] : [pick]}
        correct={result ? [detail.correct] : null}
        onToggle={setPick}
      />
    </QuestionFrame>
  );
}
