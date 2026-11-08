// Runs Python (Pyodide) and JavaScript inside the browser, in a Web Worker. No server needed, so it works when Orbit is hosted.
// The code stays in the browser tab. A worker that runs too long is killed and rebuilt, which is how time limits work.
import type { CodeLanguage } from "./codeLanguages";
import type { JudgeResponse, RunResult } from "./runner";

export const BROWSER_LANGS: CodeLanguage[] = ["python", "javascript"];
export const canRunInBrowser = (l: string) => (BROWSER_LANGS as string[]).includes(l);

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

const WORKER_SRC = `
let py = null;
const lines = (s) => s.replace(/\\r\\n?/g, "\\n").split("\\n");
async function init(lang) {
  if (lang === "python") { importScripts("${PYODIDE}pyodide.js"); py = await loadPyodide({ indexURL: "${PYODIDE}" }); }
  postMessage({ ready: true });
}
onmessage = async (e) => {
  const m = e.data;
  if (m.init) { try { await init(m.lang); } catch (err) { postMessage({ fatal: "Could not load the Python engine. Check your internet connection and try again. (" + (err && err.message || err) + ")" }); } return; }
  const t0 = Date.now(); let out = "", errs = "", status = "ok";
  try {
    if (m.lang === "python") {
      const inp = lines(m.input); if (inp[inp.length - 1] === "") inp.pop(); let k = 0;
      py.setStdin({ stdin: () => (k < inp.length ? inp[k++] : null) });
      py.setStdout({ batched: (s) => { out += s + "\\n"; } });
      py.setStderr({ batched: (s) => { errs += s + "\\n"; } });
      const g = py.globals.get("dict")();
      try { py.runPython(m.code, { globals: g }); } finally { g.destroy(); }
    } else {
      const log = (...a) => { out += a.map((x) => (typeof x === "string" ? x : (() => { try { return typeof x === "object" ? JSON.stringify(x) : String(x); } catch { return String(x); } })())).join(" ") + "\\n"; };
      const fs = { readFileSync: () => m.input };
      const req = (n) => { if (n === "fs") return fs; throw new Error("Only require('fs') is available in the browser runner."); };
      new Function("require", "console", "process", m.code)(req, { log, error: (...a) => { errs += a.join(" ") + "\\n"; }, warn: log, info: log }, { stdout: { write: (s) => { out += s; } }, argv: [], env: {} });
    }
  } catch (err) { status = "runtime_error"; errs += String((err && err.message) || err) + "\\n"; }
  postMessage({ id: m.id, status, stdout: out.slice(0, 65536), stderr: errs.slice(0, 8000), ms: Date.now() - t0 });
};
`;

type W = { w: Worker; ready: Promise<string | null> };
const workers: Partial<Record<CodeLanguage, W>> = {};

function spawn(lang: CodeLanguage): W {
  const w = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })));
  const ready = new Promise<string | null>((resolve) => {
    const on = (e: MessageEvent) => {
      if (e.data?.ready) { w.removeEventListener("message", on); resolve(null); }
      else if (e.data?.fatal) { w.removeEventListener("message", on); resolve(e.data.fatal); }
    };
    w.addEventListener("message", on);
    w.addEventListener("error", () => resolve("The browser blocked the code runner."), { once: true });
  });
  w.postMessage({ init: true, lang });
  return { w, ready };
}
const drop = (lang: CodeLanguage) => { workers[lang]?.w.terminate(); delete workers[lang]; };

/** Starts loading the engine early (Python is about 10 MB the first time, then the browser keeps it). */
export function warmUp(lang: CodeLanguage) { if (canRunInBrowser(lang) && !workers[lang]) workers[lang] = spawn(lang); }

export async function runInBrowser(lang: CodeLanguage, code: string, inputs: string[], limitMs: number): Promise<JudgeResponse> {
  if (!workers[lang]) workers[lang] = spawn(lang);
  const cur = workers[lang]!;
  const fatal = await cur.ready;
  if (fatal) { drop(lang); return { missing: fatal, results: [] }; }
  const results: RunResult[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const w = (workers[lang] ??= spawn(lang));
    if (await w.ready) { drop(lang); return { missing: "The code runner could not restart.", results }; }
    const r = await new Promise<RunResult>((resolve) => {
      const timer = setTimeout(() => { drop(lang); resolve({ status: "timeout", stdout: "", stderr: "", ms: limitMs }); }, limitMs);
      const on = (e: MessageEvent) => {
        if (e.data?.id !== i) return;
        clearTimeout(timer); w.w.removeEventListener("message", on);
        resolve({ status: e.data.status, stdout: e.data.stdout, stderr: e.data.stderr, ms: e.data.ms });
      };
      w.w.addEventListener("message", on);
      w.w.postMessage({ id: i, lang, code, input: inputs[i] });
    });
    results.push(r);
  }
  return { results };
}
