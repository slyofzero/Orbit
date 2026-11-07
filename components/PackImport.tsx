"use client";
import { useMemo, useRef, useState } from "react";
import { packPrompt, packTemplateJson, packToJson, parsePack } from "@/lib/packs";
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
export default function PackImport({ onDone }: { onDone?: () => void }) {
  const { pack, custom, install, remove } = usePack();
  const [text, setText] = useState("");
  const [keep, setKeep] = useState(false);
  const [ask, setAsk] = useState<null | "replace" | "remove">(null);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => {
    if (!text.trim()) return null;
    try { return parsePack(JSON.parse(text)); } catch (e) { return { pack: null, errors: [`This is not valid JSON: ${(e as Error).message}`], warnings: [] }; }
  }, [text]);
  const p = result?.pack ?? null;

  const useIt = () => { if (!p) return; install(p, keep); setText(""); setAsk(null); setNote(`"${p.name}" is now your pack.`); onDone?.(); };

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
          {custom ? `${pack.topics.length} topics · ${pack.questions.length} questions · ${pack.mocks.length} mock recipe${pack.mocks.length === 1 ? "" : "s"}` : "Practice and Mocks stay empty until you upload a pack."}
        </p>
        {custom && (
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn soft" onClick={() => setAsk("remove")}>Remove this pack</button>
            <button className="btn soft" onClick={() => downloadJson(`${fileSafe(pack.name)}.json`, packToJson(pack))}>Export this pack</button>
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
        <textarea className="pi-text" spellCheck={false} placeholder='…or paste the JSON here, e.g. { "name": "My pack", "topics": [ … ], "questions": [ … ] }' value={text} onChange={(e) => setText(e.target.value)} />

        {result && result.errors.length > 0 && (
          <div className="pi-err" role="alert"><b>🔴 Fix this first:</b><ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
        )}
        {result && result.warnings.length > 0 && <ul className="pi-warn">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}

        {p && (
          <div className="pi-ok">
            <b>✓ Looks good: {p.name}</b>
            <p className="small" style={{ margin: "4px 0" }}>{p.topics.length} topics in {Object.keys(p.subjects).length} subject{Object.keys(p.subjects).length === 1 ? "" : "s"} · {p.questions.length} questions ({count("mcq")} MCQ, {count("msq")} MSQ, {count("nat")} NAT) · {p.mocks.length} mock recipe{p.mocks.length === 1 ? "" : "s"}{p.mocks.length ? `: ${p.mocks.map((m) => m.name).join(", ")}` : ""}</p>
            <div className="callout">🔴 CAUTION: Using this pack replaces your current one. Your mock results are kept.</div>
            <label className="small pi-keep"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Keep my practice history (only if the question ids match the old pack)</label>
            <button className="btn primary" onClick={() => (custom ? setAsk("replace") : useIt())}>Use this pack</button>
          </div>
        )}
      </section>
      {note && <p className="small muted" role="status">{note}</p>}
      {ask && (
        <ExportFirstModal what="question pack" action={ask} oldName={pack.name} newName={p?.name}
          onExport={() => downloadJson(`${fileSafe(pack.name)}.json`, packToJson(pack))}
          onGo={() => (ask === "replace" ? useIt() : (remove(), setAsk(null), setNote("Pack removed.")))}
          onCancel={() => setAsk(null)} />
      )}
    </div>
  );
}
