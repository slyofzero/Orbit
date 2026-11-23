"use client";
import { useState } from "react";
import type { AnswerOutcome, QuestionRow, QuestionStrRow } from "@/types/tables";
import { gradeStr, type Verdict } from "@/lib/grade";
import { Rich, TextField } from "@/components/ui";
import { QuestionFrame, typedClass, type FrameResult } from "@/components/question/QuestionFrame";

const HOW = {
  exact: "Type your answer.",
  list: "Separate items with commas, in the right order.",
  set: "Separate items with commas, in any order.",
} as const;

export function StrQuestion({
  question,
  detail,
  number,
  initialOutcome,
  onAnswer,
  onRetry,
  special,
}: {
  question: QuestionRow;
  detail: QuestionStrRow;
  number?: number;
  initialOutcome?: AnswerOutcome | null;
  onAnswer?: (v: Verdict) => void;
  onRetry?: () => void; // Try again was pressed (a new attempt)
  special?: boolean;
}) {
  const [input, setInput] = useState(() => (initialOutcome === "correct" ? (detail.accepted[0] ?? "") : ""));
  const [result, setResult] = useState<FrameResult | null>(() => {
    if (initialOutcome === "correct" || initialOutcome === "incorrect") {
      const list = detail.accepted.map((a, i) => (
        <span key={i}>
          {i > 0 && " · "}
          <strong>
            <Rich text={a} />
          </strong>
        </span>
      ));
      return {
        verdict: initialOutcome,
        detail: (
          <>
            {detail.accepted.length > 1 ? "Accepted answers: " : "Correct answer: "}
            {list}
          </>
        ),
      };
    }
    return null;
  });
  const check = () => {
    const verdict = gradeStr(detail.match, detail.case_sensitive, detail.accepted, input);
    const list = detail.accepted.map((a, i) => (
      <span key={i}>
        {i > 0 && " · "}
        <strong>
          <Rich text={a} />
        </strong>
      </span>
    ));
    setResult({
      verdict,
      detail: (
        <>
          {detail.accepted.length > 1 ? "Accepted answers: " : "Correct answer: "}
          {list}
        </>
      ),
    });
    onAnswer?.(verdict);
  };
  return (
    <QuestionFrame
      question={question}
      number={number}
      special={special}
      instruction={HOW[detail.match]}
      result={result}
      canCheck={input.trim() !== ""}
      onCheck={check}
      onReset={() => {
        onRetry?.();
        setInput("");
        setResult(null);
      }}
    >
      <div className={typedClass(result?.verdict)}>
        <TextField
          label="Your answer"
          autoComplete="off"
          spellCheck={false}
          value={input}
          disabled={!!result}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !result && input.trim()) check();
          }}
          hint={detail.case_sensitive ? "Capital letters matter." : "Capital letters don't matter."}
        />
      </div>
    </QuestionFrame>
  );
}
