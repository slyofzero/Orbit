// Runs a learner's program on THIS computer (server side only). It uses whatever compilers and interpreters are installed:
// python, node, gcc/g++, javac + java. Nothing is sandboxed: the program runs with your own permissions, so only run code you wrote.
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CodeLanguage } from "./codeLanguages";

export type RunStatus = "ok" | "runtime_error" | "timeout" | "output_limit";
export interface RunResult { status: RunStatus; stdout: string; stderr: string; ms: number }
export interface JudgeResponse { compileError?: string; missing?: string; results: RunResult[] }

const CANDIDATES: Record<CodeLanguage, string[][]> = {
  python: [["python3"], ["python"], ["py", "-3"]],
  javascript: [["node"], ["bun"]],
  c: [["gcc"], ["cc"], ["clang"]],
  cpp: [["g++"], ["clang++"]],
  java: [["javac"]],
};
const INSTALL: Record<CodeLanguage, string> = {
  python: "Install Python 3 from python.org and tick 'Add to PATH'.",
  javascript: "Install Node.js from nodejs.org.",
  c: "Install a C compiler: MinGW-w64 / MSYS2 (gcc) on Windows, or Xcode command line tools on macOS.",
  cpp: "Install a C++ compiler: MinGW-w64 / MSYS2 (g++) on Windows, or Xcode command line tools on macOS.",
  java: "Install a JDK (for example Temurin) so that both javac and java are on PATH.",
};

const OUT_CAP = 64 * 1024;
const found = new Map<string, string[] | null>();

function probe(cmd: string[]): boolean {
  const flag = cmd[0] === "javac" ? "-version" : "--version";
  try {
    const r = spawnSync(cmd[0], [...cmd.slice(1), flag], { timeout: 5000, encoding: "utf8", windowsHide: true });
    return r.status === 0 && /\d/.test(`${r.stdout}${r.stderr}`) && !/Microsoft Store/i.test(`${r.stdout}${r.stderr}`);
  } catch { return false; }
}
/** The command that starts this language here, or null when it is not installed. */
export function commandFor(lang: CodeLanguage): string[] | null {
  if (found.has(lang)) return found.get(lang)!;
  const hit = CANDIDATES[lang].find(probe) ?? null;
  if (hit && lang === "java" && !probe(["java"])) { found.set(lang, null); return null; }
  found.set(lang, hit);
  return hit;
}
export const forgetCommands = () => found.clear();
export const installHint = (lang: CodeLanguage) => INSTALL[lang];

export function status(): Record<CodeLanguage, { ok: boolean; command?: string; hint?: string }> {
  const out = {} as Record<CodeLanguage, { ok: boolean; command?: string; hint?: string }>;
  for (const l of Object.keys(CANDIDATES) as CodeLanguage[]) { const c = commandFor(l); out[l] = c ? { ok: true, command: c.join(" ") } : { ok: false, hint: INSTALL[l] }; }
  return out;
}

const SAFE_ENV = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP", "HOME", "USERPROFILE", "LANG", "JAVA_HOME", "LD_LIBRARY_PATH"];
const env = () => { const e: Record<string, string> = { PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1" }; for (const k of SAFE_ENV) if (process.env[k]) e[k] = process.env[k]!; return e; };

function exec(cmd: string, args: string[], cwd: string, input: string, limitMs: number): Promise<RunResult & { code: number | null }> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let stdout = "", stderr = "", done = false, killed: RunStatus | null = null;
    const child = spawn(cmd, args, { cwd, env: env() as NodeJS.ProcessEnv, windowsHide: true });
    const finish = (code: number | null) => {
      if (done) return; done = true; clearTimeout(timer);
      const status: RunStatus = killed ?? (code === 0 ? "ok" : "runtime_error");
      resolve({ status, stdout, stderr, ms: Date.now() - t0, code });
    };
    const timer = setTimeout(() => { killed = "timeout"; child.kill("SIGKILL"); }, limitMs);
    child.stdout.on("data", (d) => { stdout += d; if (stdout.length > OUT_CAP) { stdout = stdout.slice(0, OUT_CAP); killed = "output_limit"; child.kill("SIGKILL"); } });
    child.stderr.on("data", (d) => { stderr += d; if (stderr.length > OUT_CAP) stderr = stderr.slice(0, OUT_CAP); });
    child.on("error", (e) => { stderr += String(e.message); finish(-1); });
    child.on("close", (c) => finish(c));
    child.stdin.on("error", () => { /* the program may exit before reading everything */ });
    child.stdin.end(input);
  });
}

/** Compiles once, then runs the program on every input. */
/** `cwd` is the folder the program runs inside (for questions whose data lives on disk). */
export async function judge(lang: CodeLanguage, code: string, inputs: string[], limitMs: number, cwd?: string): Promise<JudgeResponse> {
  const cmd = commandFor(lang);
  if (!cmd) return { missing: `${lang} is not installed here. ${INSTALL[lang]}`, results: [] };
  const dir = await mkdtemp(join(tmpdir(), "orbit-run-"));
  try {
    let runArgs: [string, string[]];
    if (lang === "python") { await writeFile(join(dir, "main.py"), code); runArgs = [cmd[0], [...cmd.slice(1), join(dir, "main.py")]]; }
    else if (lang === "javascript") { await writeFile(join(dir, "main.js"), code); runArgs = [cmd[0], [join(dir, "main.js")]]; }
    else if (lang === "java") {
      const cls = /public\s+(?:final\s+)?class\s+([A-Za-z_]\w*)/.exec(code)?.[1] ?? "Main";
      await writeFile(join(dir, `${cls}.java`), code);
      const c = await exec("javac", ["-encoding", "UTF-8", `${cls}.java`], dir, "", 30000);
      if (c.status !== "ok") return { compileError: (c.stderr || c.stdout || "Compilation failed.").slice(0, 4000), results: [] };
      runArgs = ["java", ["-Xss64m", "-cp", dir, cls]];
    } else {
      const file = lang === "c" ? "main.c" : "main.cpp";
      await writeFile(join(dir, file), code);
      const exe = join(dir, process.platform === "win32" ? "main.exe" : "main");
      const args = lang === "c" ? [file, "-O2", "-o", "main", "-lm"] : [file, "-O2", "-std=c++17", "-o", "main"];
      const c = await exec(cmd[0], args, dir, "", 30000);
      if (c.status !== "ok") return { compileError: (c.stderr || c.stdout || "Compilation failed.").slice(0, 4000), results: [] };
      runArgs = [exe, []];
    }
    const results: RunResult[] = [];
    for (const input of inputs) {
      const r = await exec(runArgs[0], runArgs[1], cwd ?? dir, input, limitMs + (lang === "java" ? 1500 : 0));
      results.push({ status: r.status, stdout: r.stdout, stderr: r.stderr, ms: r.ms });
    }
    return { results };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
