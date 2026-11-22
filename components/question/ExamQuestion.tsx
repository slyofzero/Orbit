"use client";
// One question of a mock, any type, in one of two modes:
//   exam    the answer area only: no Check button, no verdict. The response is controlled (`response` +
//           `onChange`) because the exam screen decides when it is saved (Save & Next).
//   review  (`review` given) locked: your response, the correct answer, the explanation and the marks earned.
// The response shape and grading are in lib/exam.ts.

import type {
  QuestionCodeRow,
  QuestionMcqRow,
  QuestionMsqRow,
  QuestionNatRow,
  QuestionRow,
  QuestionStrRow,
} from "@/types/tables";
import type { Verdict } from "@/lib/grade";
import { parseNumber } from "@/lib/grade";
import type { ExamResponse } from "@/lib/exam";
import type { QuestionDetail } from "@/lib/questions";
import { CodeEditor, Rich, TextField } from "@/components/ui";
import { QuestionFrame, typedClass, type FrameResult } from "@/components/question/QuestionFrame";
import { OptionList } from "@/components/question/OptionList";
import { fmtMarks } from "@/components/question/format";

const STR_HOW = {
  exact: "Type your answer.",
  list: "Separate items with commas, in the right order.",
  set: "Separate items with commas, in any order.",
} as const;

function instruction(q: QuestionRow, d: QuestionDetail): string {
  switch (q.type) {
    case "mcq":
      return "Pick one option.";
    case "msq":
      return "Pick every correct option. All of them must be right to score.";
    case "nat":
      return "Type a number.";
    case "str":
      return STR_HOW[(d as QuestionStrRow).match];
    case "code":
      return "Write your solution. Code questions are not marked in a mock; you'll see your code in the review.";
  }
}

/** "Correct answer: …" for the review. */
function correctText(q: QuestionRow, d: QuestionDetail) {
  if (q.type === "nat") {
    const { value, tolerance } = d as QuestionNatRow;
    return (
      <>
        Correct answer: <strong>{value}</strong>
        {tolerance > 0 && ` (anything from ${+(value - tolerance).toFixed(6)} to ${+(value + tolerance).toFixed(6)})`}
      </>
    );
  }
  if (q.type === "str") {
    const { accepted } = d as QuestionStrRow;
    return (
      <>
        {accepted.length > 1 ? "Accepted answers: " : "Correct answer: "}
        {accepted.map((a, i) => (
          <span key={i}>
            {i > 0 && " · "}
            <strong>
              <Rich text={a} />
            </strong>
          </span>
        ))}
      </>
    );
  }
  return undefined;
}

export function ExamQuestion({
  question,
  detail,
  number,
  response,
  onChange,
  review,
}: {
  question: QuestionRow;
  detail: QuestionDetail;
  number?: number;
  response: ExamResponse;
  onChange?: (r: ExamResponse) => void; // exam mode
  review?: { verdict: Verdict; marks: number | null }; // review mode: locked, with the answers
}) {
  const q = question;
  const locked = !!review;
  const set = (r: ExamResponse) => {
    if (!locked) onChange?.(r);
  };
  const result: FrameResult | null = review
    ? {
        verdict: review.verdict,
        marks: review.marks,
        detail:
          review.marks === null ? (
            "Code answers are not marked automatically, so this question isn't in the score."
          ) : (
            <>
              {correctText(q, detail)}
              {review.marks !== 0 && (
                <span className="ml-2 font-bold">{`(${review.marks > 0 ? "+" : "−"}${fmtMarks(Math.abs(review.marks))})`}</span>
              )}
            </>
          ),
      }
    : null;

  let area;
  switch (q.type) {
    case "mcq": {
      const d = detail as QuestionMcqRow;
      area = (
        <OptionList
          mode="single"
          options={d.options}
          picked={response.choice ?? []}
          correct={locked ? [d.correct] : null}
          onToggle={(i) => set({ choice: [i], typed: null })}
        />
      );
      break;
    }
    case "msq": {
      const d = detail as QuestionMsqRow;
      const picked = response.choice ?? [];
      area = (
        <OptionList
          mode="multi"
          options={d.options}
          picked={picked}
          correct={locked ? d.correct : null}
          onToggle={(i) => {
            const next = picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i].sort((a, b) => a - b);
            set({ choice: next.length ? next : null, typed: null });
          }}
        />
      );
      break;
    }
    case "nat":
    case "str": {
      const typed = response.typed ?? "";
      const notNumber = q.type === "nat" && typed.trim() !== "" && parseNumber(typed) === null;
      area = (
        <div className={typedClass(review?.verdict ?? undefined)}>
          <TextField
            label="Your answer"
            inputMode={q.type === "nat" ? "decimal" : undefined}
            autoComplete="off"
            spellCheck={false}
            value={typed}
            disabled={locked}
            placeholder={locked && !typed ? "Not answered" : undefined}
            onChange={(e) => set({ choice: null, typed: e.target.value === "" ? null : e.target.value })}
            error={
              !locked && notNumber ? "That is not a number. Use digits, a minus sign and a dot, e.g. -2.5" : undefined
            }
            hint={
              q.type === "str"
                ? (detail as QuestionStrRow).case_sensitive
                  ? "Capital letters matter."
                  : "Capital letters don't matter."
                : undefined
            }
          />
        </div>
      );
      break;
    }
    case "code": {
      const starter = (detail as QuestionCodeRow).starter ?? "";
      area = (
        <CodeEditor
          label="Your code"
          value={response.typed ?? (locked ? "" : starter)}
          onChange={(c) => set({ choice: null, typed: c })}
          rows={12}
          readOnly={locked}
        />
      );
      break;
    }
  }

  return (
    <QuestionFrame
      question={q}
      number={number}
      instruction={instruction(q, detail)}
      result={result}
      canCheck={false}
      onCheck={() => {}}
      exam={!locked}
      split={q.type === "code"}
    >
      {area}
    </QuestionFrame>
  );
}
