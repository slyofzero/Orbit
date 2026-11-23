"use client";
import { useState } from "react";
import type { AnswerOutcome, QuestionCodeRow, QuestionRow } from "@/types/tables";
import type { Verdict } from "@/lib/grade";
import { Button, CodeEditor } from "@/components/ui";
import { IconCheck, IconX } from "@/components/icons";
import { QuestionFrame, type FrameResult } from "@/components/question/QuestionFrame";

/** Code questions have no automatic checking: the learner writes code, then marks it right or wrong.
 *  `split` puts the statement beside the editor on wide screens (the Programming screen). */
export function CodeQuestion({
  question,
  detail,
  number,
  initialOutcome,
  onAnswer,
  onRetry,
  onCodeChange,
  special,
  split,
  rows = 10,
}: {
  question: QuestionRow;
  detail: QuestionCodeRow;
  number?: number;
  initialOutcome?: AnswerOutcome | null;
  onAnswer?: (v: Verdict) => void;
  onRetry?: () => void; // Try again was pressed (a new attempt)
  onCodeChange?: (code: string) => void; // every edit, e.g. to keep a draft
  special?: boolean;
  split?: boolean;
  rows?: number; // editor height in lines
}) {
  const [code, setCode] = useState(detail.starter ?? "");
  const [result, setResult] = useState<FrameResult | null>(() => {
    if (initialOutcome === "correct" || initialOutcome === "incorrect") {
      return { verdict: initialOutcome, selfMarked: true };
    }
    return null;
  });
  const mark = (verdict: Verdict) => {
    setResult({ verdict, selfMarked: true });
    onAnswer?.(verdict);
  };
  return (
    <QuestionFrame
      question={question}
      number={number}
      special={special}
      split={split}
      instruction="Write your solution, run it on your own machine, then mark how it went."
      result={result}
      canCheck={false}
      onCheck={() => {}}
      onReset={() => {
        setResult(null);
        onRetry?.();
      }}
      actions={
        <>
          <Button variant="soft" icon={<IconX />} onClick={() => mark("incorrect")}>
            I got it wrong
          </Button>
          <Button variant="primary" icon={<IconCheck />} onClick={() => mark("correct")}>
            I got it right
          </Button>
        </>
      }
    >
      <CodeEditor
        label="Your code"
        value={code}
        onChange={(c) => {
          setCode(c);
          onCodeChange?.(c);
        }}
        rows={rows}
        readOnly={!!result}
        hint={
          detail.starter
            ? "Starts with the code given in the question. Tab inserts two spaces."
            : "Tab inserts two spaces."
        }
      />
    </QuestionFrame>
  );
}
