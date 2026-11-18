"use client";
import { useState } from "react";
import type { QuestionCodeRow, QuestionRow } from "@/types/tables";
import type { Verdict } from "@/lib/grade";
import { Button, CodeEditor, IconCheck, IconX } from "@/components/ui";
import { QuestionFrame, type FrameResult } from "@/components/question/QuestionFrame";

/** Code questions have no automatic checking: the learner writes code, then marks it right or wrong. */
export function CodeQuestion({
  question,
  detail,
  number,
  onAnswer,
  special,
}: {
  question: QuestionRow;
  detail: QuestionCodeRow;
  number?: number;
  onAnswer?: (v: Verdict) => void;
  special?: boolean;
}) {
  const [code, setCode] = useState(detail.starter ?? "");
  const [result, setResult] = useState<FrameResult | null>(null);
  const mark = (verdict: Verdict) => {
    setResult({ verdict, selfMarked: true });
    onAnswer?.(verdict);
  };
  return (
    <QuestionFrame
      question={question}
      number={number}
      special={special}
      instruction="Write your solution, run it on your own machine, then mark how it went."
      result={result}
      canCheck={false}
      onCheck={() => {}}
      onReset={() => setResult(null)}
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
        onChange={setCode}
        rows={10}
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
