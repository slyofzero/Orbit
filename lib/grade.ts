// Checks a learner's answer against a question's correct answer.
// Every function returns "correct", "incorrect", or null when nothing was answered.

import type { StrMatch } from "@/types/tables";

export type Verdict = "correct" | "incorrect" | null;

const verdict = (ok: boolean): Verdict => (ok ? "correct" : "incorrect");

/** mcq: one picked option index (null = nothing picked). */
export function gradeMcq(correct: number, pick: number | null): Verdict {
  if (pick === null) return null;
  return verdict(pick === correct);
}

/** msq: all-or-nothing. Right only when the picked set equals the correct set exactly. */
export function gradeMsq(correct: number[], picks: number[]): Verdict {
  if (picks.length === 0) return null;
  const want = new Set(correct);
  const got = new Set(picks);
  return verdict(want.size === got.size && [...want].every((i) => got.has(i)));
}

/** Parses a typed number. Accepts "3", "-2.5", ".5", "1e3", " 4 ". Returns null if it is not a number. */
export function parseNumber(input: string): number | null {
  const s = input.trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  return Number(s);
}

/** nat: right when |typed − value| ≤ tolerance. Something that is not a number is wrong. */
export function gradeNat(value: number, tolerance: number, input: string): Verdict {
  if (input.trim() === "") return null;
  const n = parseNumber(input);
  if (n === null) return "incorrect";
  return verdict(Math.abs(n - value) <= tolerance + 1e-9);
}

/** Trims, collapses inner spaces, and lowercases unless the question is case sensitive. */
function norm(s: string, caseSensitive: boolean): string {
  const t = s.trim().replace(/\s+/g, " ");
  return caseSensitive ? t : t.toLowerCase();
}

/** "a, b ,c" → ["a", "b", "c"] (empty items dropped). */
function items(s: string, caseSensitive: boolean): string[] {
  return s
    .split(",")
    .map((x) => norm(x, caseSensitive))
    .filter(Boolean);
}

/** str: right when the typed answer matches ANY accepted answer.
 *  exact: whole string · list: comma-separated items in the same order · set: items in any order. */
export function gradeStr(match: StrMatch, caseSensitive: boolean, accepted: string[], input: string): Verdict {
  if (input.trim() === "") return null;
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const ok = accepted.some((ans) => {
    if (match === "exact") return norm(ans, caseSensitive) === norm(input, caseSensitive);
    const want = items(ans, caseSensitive);
    const got = items(input, caseSensitive);
    if (match === "list") return same(want, got);
    return same([...want].sort(), [...got].sort());
  });
  return verdict(ok);
}

/** Marks for one answer: +marks if right, −negative_marks if wrong, 0 if unanswered. */
export function marksFor(v: Verdict, marks: number, negativeMarks: number): number {
  if (v === "correct") return marks;
  if (v === "incorrect") return -negativeMarks;
  return 0;
}
