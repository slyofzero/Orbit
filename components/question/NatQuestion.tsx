"use client";
import { useState } from "react";
import type { QuestionNatRow, QuestionRow } from "@/types/tables";
import { gradeNat, parseNumber, type Verdict } from "@/lib/grade";
import { TextField } from "@/components/ui";
import { QuestionFrame, typedClass, type FrameResult } from "@/components/question/QuestionFrame";

export function NatQuestion({
  question,
  detail,
  number,
  onAnswer,
  special,
}: {
  question: QuestionRow;
  detail: QuestionNatRow;
  number?: number;
  onAnswer?: (v: Verdict) => void;
  special?: boolean;
}) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<FrameResult | null>(null);
  const notNumber = input.trim() !== "" && parseNumber(input) === null;
  const { value, tolerance } = detail;
  const range =
    tolerance > 0
      ? ` (anything from ${+(value - tolerance).toFixed(6)} to ${+(value + tolerance).toFixed(6)} counts)`
      : "";
  const check = () => {
    const verdict = gradeNat(value, tolerance, input);
    setResult({
      verdict,
      detail: (
        <>
          Correct answer: <strong>{value}</strong>
          {range}
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
      instruction="Type a number."
      result={result}
      canCheck={input.trim() !== "" && !notNumber}
      onCheck={check}
      onReset={() => {
        setInput("");
        setResult(null);
      }}
    >
      <div className={typedClass(result?.verdict)}>
        <TextField
          label="Your answer"
          inputMode="decimal"
          autoComplete="off"
          value={input}
          disabled={!!result}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !result && input.trim() && !notNumber) check();
          }}
          error={notNumber ? "That is not a number. Use digits, a minus sign and a dot, e.g. -2.5" : undefined}
          hint={tolerance > 0 ? "Small rounding differences are accepted." : "Give the exact value."}
        />
      </div>
    </QuestionFrame>
  );
}
