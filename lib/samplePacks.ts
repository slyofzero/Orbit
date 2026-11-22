// The DEV buttons' sample question files ("orbit-questions", lib/questionFile.ts). They are imported through the
// very same importer as an uploaded file (pack.import), so each click makes a real pack that the Upload tab
// lists. `n` numbers the sample ("Sample program 3") and keeps its text unique, so the importer never drops it as
// a question that is already in the bank. Used by lib/db/queries/dev.ts; tests in scripts/checks/manage.ts.

import { PACK_FORMAT, PACK_VERSION } from "@/lib/questionFile";

export type SampleKind = "question" | "code" | "mock";

const SUBJECT = "Dev subject";
const TOPIC = "Dev topic";

/** The file name each sample is imported under, e.g. "sample-mock-3.json". */
export const sampleFileName = (kind: SampleKind, n: number) => `sample-${kind}-${n}.json`;

/** One sample question file: `question` = one practice MCQ, `code` = one programming question, `mock` = a
 *  30-minute full-screen mock with one section of three mock-only MCQs. */
export function sampleFile(kind: SampleKind, n: number) {
  const base = { format: PACK_FORMAT, version: PACK_VERSION };
  if (kind === "question")
    return {
      ...base,
      name: `Sample question ${n}`,
      questions: [
        {
          id: "q1",
          subject: SUBJECT,
          topic: TOPIC,
          type: "mcq",
          difficulty: "easy",
          marks: 1,
          negative_marks: 0.33,
          text: `Sample question ${n}: what is $\\int_0^1 ${n}x\\,dx$?`,
          options: [`$${n / 2}$`, `$${n}$`, `$${n * 2}$`, "$0$"],
          answer: "A",
          explanation: `$\\int_0^1 ${n}x\\,dx = \\frac{${n}}{2}$.`,
        },
      ],
    };
  if (kind === "code")
    return {
      ...base,
      name: `Sample program ${n}`,
      questions: [
        {
          id: "c1",
          subject: SUBJECT,
          topic: TOPIC,
          type: "code",
          difficulty: "easy",
          marks: 1,
          negative_marks: 0,
          text: `Sample program ${n}: write a function \`total(xs)\` that returns the sum of the list \`xs\`.\n\nFor example, \`total([1, 2, 3])\` is $6$.`,
          starter: "def total(xs):\n    # your code here\n    pass\n",
          explanation: "```python\ndef total(xs):\n    return sum(xs)\n```",
        },
      ],
    };
  const qs = [1, 2, 3].map((k) => ({
    id: `m${k}`,
    subject: SUBJECT,
    topic: TOPIC,
    type: "mcq",
    difficulty: "easy",
    marks: 1,
    negative_marks: 0.33,
    text: `Mock ${n}, question ${k}: what is $${k} + ${k}$?`,
    options: [`$${k}$`, `$${2 * k}$`, `$${3 * k}$`, "$0$"],
    answer: "B",
    explanation: `$${k} + ${k} = ${2 * k}$.`,
    pool: "mock",
  }));
  return {
    ...base,
    name: `Sample mock ${n}`,
    questions: qs,
    mocks: [
      {
        name: `Sample mock ${n}`,
        minutes: 30,
        instructions: "A short sample paper: **3 questions**, 30 minutes.",
        full_screen: true,
        sections: [{ name: "Section A", questions: qs.map((q) => q.id) }],
      },
    ],
  };
}
