"use client";
// Shows a question with the component of its type, so a screen can hold a list of mixed questions.

import type {
  QuestionCodeRow,
  QuestionMcqRow,
  QuestionMsqRow,
  QuestionNatRow,
  QuestionRow,
  QuestionStrRow,
} from "@/types/tables";
import type { Verdict } from "@/lib/grade";
import type { QuestionDetail } from "@/lib/questions";
import { McqQuestion } from "@/components/question/McqQuestion";
import { MsqQuestion } from "@/components/question/MsqQuestion";
import { NatQuestion } from "@/components/question/NatQuestion";
import { StrQuestion } from "@/components/question/StrQuestion";
import { CodeQuestion } from "@/components/question/CodeQuestion";

export function AnyQuestion({
  question,
  detail,
  number,
  onAnswer,
  special,
}: {
  question: QuestionRow;
  detail: QuestionDetail; // the row of the type table that matches question.type
  number?: number;
  onAnswer?: (v: Verdict) => void;
  special?: boolean;
}) {
  const common = { question, number, onAnswer, special };
  switch (question.type) {
    case "mcq":
      return <McqQuestion {...common} detail={detail as QuestionMcqRow} />;
    case "msq":
      return <MsqQuestion {...common} detail={detail as QuestionMsqRow} />;
    case "nat":
      return <NatQuestion {...common} detail={detail as QuestionNatRow} />;
    case "str":
      return <StrQuestion {...common} detail={detail as QuestionStrRow} />;
    case "code":
      return <CodeQuestion {...common} detail={detail as QuestionCodeRow} />;
  }
}
