import { Answer, Question } from "./types";

export function isAttempted(a: Answer | undefined): boolean {
  if (a === undefined || a === null) return false;
  if (Array.isArray(a)) return a.length > 0;
  if (typeof a === "string") return a.trim() !== "";
  return true;
}

export function isCorrect(q: Question, a: Answer | undefined): boolean {
  if (!isAttempted(a)) return false;
  if (q.type === "mcq") return a === q.answer;
  if (q.type === "msq") {
    const given = [...(a as number[])].sort();
    const want = [...(q.answer as number[])].sort();
    return given.length === want.length && given.every((x, i) => x === want[i]);
  }
  const { value, tol } = q.answer as { value: number; tol: number };
  const x = parseFloat(String(a));
  return !Number.isNaN(x) && Math.abs(x - value) <= tol + 1e-9;
}

// GATE marking: MCQ has negative marking (1/3 for 1-mark, 2/3 for 2-mark), MSQ and NAT have none.
export function marksFor(q: Question, a: Answer | undefined): number {
  if (!isAttempted(a)) return 0;
  if (isCorrect(q, a)) return q.marks;
  if (q.type === "mcq") return q.marks === 1 ? -1 / 3 : -2 / 3;
  return 0;
}

export const negLabel = (q: Question) => (q.type === "mcq" ? (q.marks === 1 ? "1/3" : "2/3") : "0");

export function formatAnswer(q: Question): string {
  if (q.type === "code") return "see the reference solution";
  if (q.type === "mcq") return String.fromCharCode(65 + (q.answer as number)) + (q.options ? `. ${q.options[q.answer as number]}` : "");
  if (q.type === "msq") return (q.answer as number[]).map((i) => String.fromCharCode(65 + i)).join(", ");
  const { value, tol } = q.answer as { value: number; tol: number };
  return tol > 0.0105 ? `${value} (range ${+(value - tol).toFixed(4)} to ${+(value + tol).toFixed(4)})` : `${value}`;
}

export function formatGiven(q: Question, a: Answer | undefined): string {
  if (!isAttempted(a)) return "Not attempted";
  if (q.type === "mcq") return String.fromCharCode(65 + (a as number));
  if (q.type === "msq") return (a as number[]).map((i) => String.fromCharCode(65 + i)).sort().join(", ");
  return String(a);
}
