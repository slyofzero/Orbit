"use client";
import { useEffect, useRef, useState } from "react";
import { CodeLanguage, LANGUAGE_LABEL } from "@/lib/codeLanguages";
import { canRunInBrowser, warmUp } from "@/lib/browserRunner";
import { Graded, gradeCode, runtimeStatus, RuntimeStatus } from "@/lib/judge";
import { KEYS, usePersisted } from "@/lib/store";
import { Question } from "@/lib/types";
import { setupPrompt } from "@/lib/setupPrompt";
import Rich from "./Rich";

const SKELETON: Record<CodeLanguage, string> = {
  python: "# read the input with input() and print the answer\n",
  javascript: "const lines = require('fs').readFileSync(0, 'utf8').split('\\n');\n// print the answer with console.log\n",
  c: "#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n",
  java: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        \n    }\n}\n",
};

let cached: Promise<{ languages?: RuntimeStatus; error?: string }> | null = null;
const setup = () => (cached ??= runtimeStatus());

// The body of a programming question: examples, a code editor, Run examples and Submit.
export default function CodeQuestion({ q, onSubmit, onReset }: {
  q: Question; onSubmit: (right: boolean) => void; onReset: () => void;
}) {
  const spec = q.code!;
  const lang = spec.language as CodeLanguage;
  const [drafts, setDrafts] = usePersisted<Record<string, string>>(KEYS.drafts, {});
  const [code, setCode] = useState<string | null>(null);
  const [env, setEnv] = useState<{ languages?: RuntimeStatus; error?: string } | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [res, setRes] = useState<{ what: "run" | "submit"; g: Graded } | null>(null);
  const [state, setState] = useState<"open" | "done">("open");
  const first = useRef(true);
  const [copied, setCopied] = useState("");
  const dir = drafts[`dir:${q.id}`] ?? "";

  useEffect(() => { setup().then(setEnv); }, []);
  useEffect(() => { if (code === null) setCode(drafts[q.id] ?? spec.starter ?? SKELETON[lang]); }, [code, drafts, q.id, spec.starter, lang]);
  useEffect(() => {
    if (code === null) return;
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => setDrafts((d) => ({ ...d, [q.id]: code })), 500);
    return () => clearTimeout(t);
  }, [code, q.id, setDrafts]);

  const status = env?.languages?.[lang];
  const serverOk = !!status?.ok;
  const inBrowser = !!env && !serverOk && canRunInBrowser(lang) && !spec.setup;
  const blocked = !env ? "Checking your setup…"
    : serverOk || inBrowser ? ""
    : spec.setup && canRunInBrowser(lang) ? "This question works on files, so it needs Orbit running on your own computer (not the hosted site)."
    : env.error ? env.error : status && !status.ok ? `${LANGUAGE_LABEL[lang]} is not installed on this computer. ${status.hint ?? ""}` : "";
  useEffect(() => { if (inBrowser) warmUp(lang); }, [inBrowser, lang]);
  const examples = spec.tests.filter((t) => !t.hidden).slice(0, 3);

  const go = async (what: "run" | "submit") => {
    if (code === null || busy || blocked) return;
    setBusy(what); setRes(null);
    const g = await gradeCode(q, code, what === "run" ? "visible" : "all", dir.trim() || undefined, inBrowser ? "browser" : "server");
    setRes({ what, g }); setBusy(null);
    if (what === "submit" && !g.failure && !g.missing) { setState("done"); onSubmit(!g.compileError && g.total > 0 && g.passed === g.total); }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go("run"); return; }
    if (e.key === "Tab") {
      e.preventDefault();
      const a = el.selectionStart, b = el.selectionEnd, v = el.value;
      const next = `${v.slice(0, a)}    ${v.slice(b)}`;
      setCode(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 4; });
    }
  };

  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(setupPrompt(q)); setCopied("Prompt copied. Paste it into your AI, run the script it gives you, then paste the folder path below."); }
    catch { setCopied("Copy was blocked by the browser."); }
  };
  const reset = () => { setState("open"); setRes(null); onReset(); };
  const right = res?.what === "submit" && !res.g.compileError && res.g.total > 0 && res.g.passed === res.g.total;
  const locked = state !== "open";

  return (
    <div className="cq">
      {examples.length > 0 && (
        <div className="cq-ex">
          {examples.map((t, i) => (
            <div key={i} className="cq-pair">
              <div><span className="cq-lab">Example {i + 1} input</span><pre className="code cq-io">{t.input || "(no input)"}</pre></div>
              <div><span className="cq-lab">Output</span><pre className="code cq-io">{t.output}</pre></div>
            </div>
          ))}
        </div>
      )}
      {spec.setup && (
        <div className="cq-setup">
          <b>This question needs some setup first</b>
          <div className="small"><Rich text={spec.setup} /></div>
          <div className="row">
            <button className="btn primary" onClick={copyPrompt}>Copy setup prompt</button>
            <span className="small muted">Give it to your AI. It writes a script that builds this data on your computer.</span>
          </div>
          <label className="small">Practice folder (the full path the script printed)
            <input className="ad-in" spellCheck={false} placeholder="C:\Users\you\orbit-practice-id" value={dir} onChange={(e) => setDrafts((d) => ({ ...d, [`dir:${q.id}`]: e.target.value }))} />
          </label>
          <span className="small muted">{dir.trim() ? "Run examples and Submit run your code inside this folder, so relative paths like data/a.txt work. You can also run your code yourself in that folder." : "Until you set the folder, your code runs in an empty temporary folder and tests that need the data will fail."}</span>
          {copied && <span className="small" role="status">{copied}</span>}
        </div>
      )}
      <div className="cq-bar"><b>{LANGUAGE_LABEL[lang]}</b><span className="small muted">Reads from standard input, prints to standard output. Tab inserts spaces. Ctrl+Enter runs the examples.</span></div>
      <textarea
        className="cq-ed" spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-label="Your code"
        rows={Math.min(26, Math.max(10, (code ?? "").split("\n").length + 1))}
        value={code ?? ""} onChange={(e) => setCode(e.target.value)} onKeyDown={onKey} readOnly={locked}
      />
      {inBrowser && <p className="small muted" style={{ margin: "6px 0 0" }}>Your code runs inside this browser tab. {lang === "python" ? "The first Python run downloads about 10 MB, then it is kept." : ""}</p>}
      {blocked && env && <div className="callout" role="alert">🔴 CAUTION: {blocked}</div>}
      <div className="row" style={{ marginTop: 10 }}>
        {state === "open" ? (
          <>
            <button className="btn" onClick={() => go("run")} disabled={!!busy || !!blocked || code === null}>{busy === "run" ? "Running…" : "Run examples"}</button>
            <button className="btn primary" onClick={() => go("submit")} disabled={!!busy || !!blocked || code === null}>{busy === "submit" ? "Checking…" : "Submit"}</button>
            <button className="btn soft" onClick={() => setCode(spec.starter ?? SKELETON[lang])} disabled={!!busy}>Reset code</button>
          </>
        ) : <button className="btn" onClick={reset}>Try again</button>}
      </div>

      {res && (
        <div className={`verdict ${res.what === "submit" ? (right ? "ok" : "no") : ""}`}>
          {res.g.failure && <b>{res.g.failure}</b>}
          {res.g.missing && <b>🔴 {res.g.missing}</b>}
          {res.g.compileError && <><b>It did not compile</b><pre className="code cq-io">{res.g.compileError}</pre></>}
          {!res.g.failure && !res.g.missing && !res.g.compileError && (
            <>
              <b>{res.what === "submit" ? (right ? "Correct ✓ All tests passed" : "Not quite ✗") : "Examples"}: {res.g.passed} of {res.g.total} test{res.g.total === 1 ? "" : "s"} passed</b>
              {res.g.outcomes.map((o) => (
                <div key={o.index} className={`cq-res ${o.verdict}`}>
                  <span>{o.verdict === "pass" ? "✓" : "✗"} {o.hidden ? `Hidden test ${o.index + 1}` : `Test ${o.index + 1}`}: {o.verdict === "pass" ? `passed (${o.ms} ms)` : o.verdict === "timeout" ? "ran out of time" : o.verdict === "error" ? "crashed" : "wrong output"}</span>
                  {o.verdict !== "pass" && !o.hidden && (
                    <div className="cq-diff">
                      <div><span className="cq-lab">Input</span><pre className="code cq-io">{o.input || "(no input)"}</pre></div>
                      <div><span className="cq-lab">Expected</span><pre className="code cq-io">{o.expected}</pre></div>
                      <div><span className="cq-lab">Your output</span><pre className="code cq-io">{o.got || "(nothing)"}</pre></div>
                      {o.stderr && <div><span className="cq-lab">Error</span><pre className="code cq-io">{o.stderr.slice(0, 1500)}</pre></div>}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {locked && (
        <div className="verdict">
          {spec.solution && <><b>Reference solution</b><pre className="code" data-lang={spec.language}><code>{spec.solution}</code></pre></>}
          <div style={{ marginTop: 6 }}><Rich text={q.explanation} /></div>
        </div>
      )}
    </div>
  );
}
