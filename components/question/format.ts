import type { Difficulty, QuestionType } from "@/types/tables";
import type { PillTone } from "@/components/ui";

export const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "Single choice",
  msq: "Multiple choice",
  nat: "Numerical",
  str: "Text answer",
  code: "Code",
};

export const DIFFICULTY_TONE: Record<Difficulty, PillTone> = { easy: "green", medium: "amber", hard: "red" };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** 2 → "2", 0.6667 → "0.67". */
export const fmtMarks = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));

/** 0 → "A", 1 → "B", … */
export const letter = (i: number) => String.fromCharCode(65 + i);
