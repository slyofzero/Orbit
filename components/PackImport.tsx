"use client";
import { useMemo, useRef, useState } from "react";
import { mergePack, packPrompt, packTemplateJson, parsePack, type PackData } from "@/lib/packs";
import { exportPack } from "@/lib/imageStore";
import { downloadJson, fileSafe } from "@/lib/download";
import ExportFirstModal from "./ExportFirstModal";
import { usePack } from "@/lib/store";

const save = (name: string, text: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.click();
};

// Where you load the questions: a JSON "question pack" with topics, questions and mock-test recipes.
const mockQs = (p: PackData) => p.mockTests.reduce((n, m) => n + m.sections.reduce((k, x) => k + x.questions.length, 0), 0);

export default function PackImport({ onDone }: { onDone?: () => void }) {
  const { pack, custom, install, remove } = usePack();
  const [text, setText] = useState("");
  const [keep, setKeep] = useState(false);
  const [mode, setMode] = useState<"add" | "replace">("add"); // when you already have a pack, adding is the default
  const [ask, setAsk] = useState<null | "replace" | "remove">(null);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => {
    if (!text.trim()) return null;
    try { return parsePack(JSON.parse(text)); } catch (e) { return { pack: null, errors: [`This is not valid JSON: ${(e as Error).message}`], warnings: [], images: {} as Record<string, string> }; }
  }, [text]);
  const p = result?.pack ?? null;
  const merged = useMemo(() => (p && custom ? mergePack(pack, p) : null), [p, custom, pack]);
  const adding = custom && mode === "add";

  const addIt = async () => { if (!merged || !result) return; await install(merged.pack, true, result.images); setText(""); const r = merged.report; setNote(`Added ${r.newQuestions} practice question${r.newQuestions === 1 ? "" : "s"}${r.newMockQuestions ? ` and ${r.newMockQuestions} mock question${r.newMockQuestions === 1 ? "" : "s"}` : ""} to "${pack.name}". It now has ${merged.pack.questions.length}.`); onDone?.(); };
  const useIt = async () => { if (!p || !result) return; await install(p, keep, result.images); setText(""); setAsk(null); setNote(`"${p.name}" is now your pack.`); onDone?.(); };

  const copy = async (what: string, value: string) => {
    try { await navigator.clipboard.writeText(value); setNote(`${what} copied.`); } catch { setNote("Copy was blocked by the browser. Use Download instead."); }
  };
  const count = (t: string) => p?.questions.filter((q) => q.type === t).length ?? 0;

  return (
    <div className="pi">
      <section className="panel pi-now">
        <div className="small muted">Your current question pack</div>
        <h2 style={{ margin: "2px 0 4px" }}>{custom ? pack.name : "None loaded"}</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {custom ? `${pack.topics.length} topics · ${pack.questions.length} practice questions · ${pack.mockTests.length} mock recipe${pack.mocks.length === 1 ? "" : "s"}` : "Practice and Mocks stay empty until you upload a pack."}
        </p>
        {custom && (
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn soft" onClick={() => setAsk("remove")}>Remove this pack</button>
            <button className="btn soft" onClick={async () => downloadJson(`${fileSafe(pack.name)}.json`, await exportPack(pack))}>Export this pack</button>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>1. Get a pack file</h2>
        <p className="muted small">A pack is one JSON file with your topics, your questions (multiple choice, multiple select or typed number), and optional mock-test recipes. Write it from the template, or let an AI write it for you. Maths is written as LaTeX between dollar signs (the AI prompt explains how), and it is drawn in Practice and in mock tests.</p>
        <div className="row">
          <button className="btn soft" onClick={() => save("my-question-pack-template.json", packTemplateJson())}>Download template</button>
          <button className="btn soft" onClick={() => copy("Template", packTemplateJson())}>Copy template</button>
          <button className="btn primary" onClick={() => copy("AI prompt", packPrompt())}>Copy AI prompt</button>
          {custom && <button className="btn soft" onClick={() => copy("AI prompt for adding", packPrompt(pack))} title="Includes your current subject and topic ids, so the AI writes new questions that fit">Copy AI prompt for adding</button>}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Copy AI prompt: paste it into any AI chat, fill in your subject and topics, and paste the JSON it gives back in step 2.</p>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>2. Upload or paste it</h2>
        <div className="row">
          <button className="btn soft" onClick={() => fileRef.current?.click()}>Upload JSON file</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setText(await f.text()); } e.target.value = ""; }} />
          {text && <button className="btn soft" onClick={() => setText("")}>Clear</button>}
        </div>
        <textarea className="pi-text" spellCheck={false} placeholder='…or paste the JSON here, e.g. { "name": "My pack", "topics": [ … ], "questions": [ … ] }' value={text.length > 400_000 ? `(${(text.length / 1e6).toFixed(1)} MB file loaded, too big to show here. Check the preview below, then use it or press Clear.)` : text} readOnly={text.length > 400_000} onChange={(e) => setText(e.target.value)} />

        {result && result.errors.length > 0 && (
          <div className="pi-err" role="alert"><b>🔴 Fix this first:</b><ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
        )}
        {result && result.warnings.length > 0 && <ul className="pi-warn">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}

        {p && (
          <div className="pi-ok">
            <b>✓ Looks good: {p.name}</b>
            <p className="small" style={{ margin: "4px 0" }}>{p.topics.length} topics in {Object.keys(p.subjects).length} subject{Object.keys(p.subjects).length === 1 ? "" : "s"} · {p.questions.length} practice questions ({count("mcq")} MCQ, {count("msq")} MSQ, {count("nat")} NAT) · {p.mockTests.length} mock test{p.mockTests.length === 1 ? "" : "s"} with {mockQs(p)} questions of their own{p.mockTests.length ? `: ${p.mockTests.map((m) => m.name).join(", ")}` : ""}{p.mocks.length ? ` · ${p.mocks.length} old-style recipe${p.mocks.length === 1 ? "" : "s"}` : ""}</p>
            {custom && (
              <div className="pi-mode" role="radiogroup" aria-label="What to do with this file">
                <button role="radio" aria-checked={mode === "add"} className={mode === "add" ? "on" : ""} onClick={() => setMode("add")}><b>Add to my pack</b><span>Keeps everything you have and appends the new questions.</span></button>
                <button role="radio" aria-checked={mode === "replace"} className={mode === "replace" ? "on" : ""} onClick={() => setMode("replace")}><b>Replace my pack</b><span>Swaps your whole pack for this file.</span></button>
              </div>
            )}
            {adding && merged && (
              <div className="pi-merge">
                <b>After adding: {merged.pack.questions.length} questions ({merged.pack.topics.length} topics, {Object.keys(merged.pack.subjects).length} subjects)</b>
                <ul>
                  <li>+{merged.report.newQuestions} new practice question{merged.report.newQuestions === 1 ? "" : "s"}{merged.report.newTopics ? `, +${merged.report.newTopics} new topic${merged.report.newTopics === 1 ? "" : "s"}` : ""}{merged.report.newSubjects ? `, +${merged.report.newSubjects} new subject${merged.report.newSubjects === 1 ? "" : "s"}` : ""}{merged.report.newMocks ? `, +${merged.report.newMocks} mock recipe${merged.report.newMocks === 1 ? "" : "s"}` : ""}</li>
                  {(merged.report.newMockTests > 0 || merged.report.newMockQuestions > 0) && <li>+{merged.report.newMockTests} new mock test{merged.report.newMockTests === 1 ? "" : "s"}, {merged.report.newMockQuestions} mock question{merged.report.newMockQuestions === 1 ? "" : "s"} in total (mock questions stay out of Practice)</li>}
                  {merged.report.mockDuplicates > 0 && <li>{merged.report.mockDuplicates} mock question{merged.report.mockDuplicates === 1 ? " is" : "s are"} already in one of your mocks, skipped</li>}
                  {merged.report.duplicates > 0 && <li>{merged.report.duplicates} already in your pack, skipped</li>}
                  {merged.report.renamed > 0 && <li>{merged.report.renamed} got a new id because that id was taken by a different question</li>}
                  {merged.report.renamedMocks > 0 && <li>{merged.report.renamedMocks} mock recipe{merged.report.renamedMocks === 1 ? " has" : "s have"} the same id as one you have, so it is added as a separate recipe</li>}
                  {merged.report.warnings.map((w, i) => <li key={i} className="warn">{w}</li>)}
                </ul>
                <p className="small muted" style={{ margin: "4px 0 0" }}>Your practice history and mock results are kept.</p>
              </div>
            )}
            {!adding && custom && <div className="callout">🔴 CAUTION: Replacing swaps your whole pack for this file. Your mock results are kept.</div>}
            {!adding && <label className="small pi-keep"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Keep my practice history (only if the question ids match the old pack)</label>}
            <button className="btn primary" disabled={adding && merged?.report.newQuestions === 0 && merged.report.newMocks === 0 && merged.report.newTopics === 0 && merged.report.newMockQuestions === 0} onClick={() => (adding ? addIt() : custom ? setAsk("replace") : useIt())}>{adding ? "Add to my pack" : custom ? "Replace my pack" : "Use this pack"}</button>
          </div>
        )}
      </section>
      {note && <p className="small muted" role="status">{note}</p>}
      {ask && (
        <ExportFirstModal what="question pack" action={ask} oldName={pack.name} newName={p?.name}
          onExport={() => { exportPack(pack).then((j) => downloadJson(`${fileSafe(pack.name)}.json`, j)); }}
          onGo={() => (ask === "replace" ? useIt() : (remove(), setAsk(null), setNote("Pack removed.")))}
          onCancel={() => setAsk(null)} />
      )}
    </div>
  );
}
