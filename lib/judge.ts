// Grades a programming question in the browser: sends the code to /api/run and compares what the program printed.
import type { Question } from "./types";
import type { JudgeResponse } from "./runner";
import type { CodeLanguage } from "./codeLanguages";
import { runInBrowser } from "./browserRunner";

/** Same answer when every line matches after ignoring spaces at the ends of lines and blank lines at the end. */
export function sameOutput(expected: string, got: string): boolean {
  const norm = (s: string) => s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");
  return norm(expected) === norm(got);
}

export type Verdict = "pass" | "fail" | "error" | "timeout";
export interface TestOutcome { index: number; hidden: boolean; verdict: Verdict; input: string; expected: string; got: string; stderr: string; ms: number }
export interface Graded { compileError?: string; missing?: string; failure?: string; outcomes: TestOutcome[]; passed: number; total: number }

export type RuntimeStatus = Record<CodeLanguage, { ok: boolean; command?: string; hint?: string }>;
const HEAD = { "content-type": "application/json", "x-orbit-run": "1" };

export async function runtimeStatus(): Promise<{ languages?: RuntimeStatus; error?: string }> {
  try {
    const r = await fetch("/api/run", { headers: { "x-orbit-run": "1" } });
    const j = await r.json();
    return r.ok ? { languages: j.languages } : { error: j.error ?? "Could not check your setup." };
  } catch { return { error: "Could not reach the Orbit server." }; }
}

/** Runs the learner's code on the visible tests, or on all of them. */
export async function gradeCode(q: Question, code: string, scope: "visible" | "all", cwd?: string, where: "server" | "browser" = "server"): Promise<Graded> {
  const spec = q.code!;
  const picked = spec.tests.map((t, index) => ({ t, index })).filter(({ t }) => scope === "all" || !t.hidden);
  const none: Graded = { outcomes: [], passed: 0, total: picked.length };
  let res: JudgeResponse;
  if (where === "browser") {
    try { res = await runInBrowser(spec.language as CodeLanguage, code, picked.map(({ t }) => t.input), spec.timeLimitMs ?? 3000); }
    catch { return { ...none, failure: "The browser could not run the code." }; }
  } else try {
    const r = await fetch("/api/run", { method: "POST", headers: HEAD, body: JSON.stringify({ language: spec.language, code, inputs: picked.map(({ t }) => t.input), timeLimitMs: spec.timeLimitMs ?? 3000, cwd }) });
    const j = await r.json();
    if (!r.ok) return { ...none, failure: j.error ?? "The runner refused this request." };
    res = j;
  } catch { return { ...none, failure: "Could not reach the Orbit server, so the code was not run." }; }
  if (res.missing) return { ...none, missing: res.missing };
  if (res.compileError) return { ...none, compileError: res.compileError };
  const outcomes = picked.map(({ t, index }, k): TestOutcome => {
    const r = res.results[k];
    const verdict: Verdict = !r ? "error" : r.status === "timeout" ? "timeout" : r.status !== "ok" ? "error" : sameOutput(t.output, r.stdout) ? "pass" : "fail";
    return { index, hidden: !!t.hidden, verdict, input: t.input, expected: t.output, got: r?.stdout ?? "", stderr: r?.stderr ?? "", ms: r?.ms ?? 0 };
  });
  return { outcomes, passed: outcomes.filter((o) => o.verdict === "pass").length, total: outcomes.length };
}
