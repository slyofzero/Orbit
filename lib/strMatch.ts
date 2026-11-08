// Grading for "str" questions: a short text answer such as "I,D,B". Both sides are normalised first, then compared.
import type { Question } from "./types";

export type StrMatch = "exact" | "list" | "set";

/** Trim, drop every space, lowercase unless case matters. */
const clean = (s: string, caseSensitive: boolean) => { const t = s.replace(/\s+/g, ""); return caseSensitive ? t : t.toLowerCase(); };
/** "NIL" (any case) and "" both mean the empty list. */
const isNil = (s: string) => s === "" || s.toLowerCase() === "nil";
const items = (s: string, caseSensitive: boolean): string[] => (isNil(s) ? [] : s.split(",").map((x) => clean(x, caseSensitive)).filter((x) => x !== ""));

/** Is `given` equal to the single expected string `want` under the chosen match mode? */
export function strEqual(given: string, want: string, match: StrMatch = "exact", caseSensitive = false): boolean {
  const g = clean(given, caseSensitive), w = clean(want, caseSensitive);
  if (isNil(g) || isNil(w)) return isNil(g) && isNil(w);
  if (match === "exact") return g === w;
  const a = items(given, caseSensitive), b = items(want, caseSensitive);
  if (match === "list") return a.length === b.length && a.every((x, i) => x === b[i]);
  const sa = new Set(a), sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

/** The accepted answers of a str question, always as a list. */
export const strAnswers = (q: Question): string[] => (Array.isArray(q.answer) ? (q.answer as unknown[]).map(String) : [String(q.answer)]);

export const strCorrect = (q: Question, given: string): boolean => strAnswers(q).some((w) => strEqual(given, w, q.match ?? "exact", q.caseSensitive ?? false));

/** How to describe the answer the learner has to type. */
export const strHint = (q: Question): string =>
  q.match === "list" ? "Comma-separated, in order. Type NIL for an empty list." : q.match === "set" ? "Comma-separated, any order. Type NIL for an empty list." : "";
