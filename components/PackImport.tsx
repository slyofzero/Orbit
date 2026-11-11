"use client";
import { useMemo, useRef, useState } from "react";
import { mergeChanges, mergePack, packPrompt, packTemplateJson, parsePack, type PackData } from "@/lib/packs";
import { exportPack } from "@/lib/imageStore";
import { downloadJson, fileSafe } from "@/lib/download";
import { toast } from "@/lib/toast";
import { mergeFiles, type FileProblems } from "@/lib/packMerge";
import PackBreakdown from "./PackBreakdown";
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

export default function PackImport({ onDone }: { onDone?: (message: string) => void }) {
  const { pack, custom, install, remove } = usePack();
  const [text, setText] = useState("");
  const [keep, setKeep] = useState(false);
  const [mode, setMode] = useState<"add" | "replace">("add"); // when you already have a pack, adding is the default
  const [ask, setAsk] = useState<null | "replace" | "remove">(null);
  const [newName, setNewName] = useState(""); // a name typed for the file being loaded; empty means keep the name inside the file
  const [renaming, setRenaming] = useState<string | null>(null); // the draft while the current pack is being renamed
  const [loadErrors, setLoadErrors] = useState<FileProblems[]>([]);
  const [mergeNotes, setMergeNotes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const adding = custom && mode === "add";
  const result = useMemo(() => {
    if (!text.trim()) return null;
    try { return parsePack(JSON.parse(text), adding ? pack : undefined); } catch (e) { return { pack: null, errors: [`This is not valid JSON: ${(e as Error).message}`], warnings: [], autoIds: 0, images: {} as Record<string, string> }; }
  }, [text, adding, pack]);
  const p = result?.pack ?? null;
  const merged = useMemo(() => (p && custom ? mergePack(pack, p) : null), [p, custom, pack]);

  const addIt = async () => {
    if (!merged || !result) return;
    await install(merged.pack, true, result.images);
    setText("");
    const r = merged.report, added = r.newQuestions + r.newMockQuestions, replaced = r.updatedQuestions + r.updatedMockQuestions;
    const m = `Added ${added} question${added === 1 ? "" : "s"}${replaced ? ` and replaced ${replaced}` : ""} in "${pack.name}".`;
    toast(m);
    onDone?.(m);
  };
  const useIt = async () => { if (!p || !result) return; const named = { ...p, name: chosen }; await install(named, keep, result.images); setNewName(""); setText(""); setAsk(null); const m = `"${chosen}" is now your pack: ${p.questions.length} practice question${p.questions.length === 1 ? "" : "s"}.`; toast(m); onDone?.(m); };

  const copy = async (what: string, value: string) => {
    try { await navigator.clipboard.writeText(value); toast(`${what} copied.`); } catch { toast("Copy was blocked by the browser. Use Download instead."); }
  };
  const chosen = (newName.trim() || p?.name || "").slice(0, 60);
  const count = (t: string) => p?.questions.filter((q) => q.type === t).length ?? 0;

  return (
    <div className="pi">
      <section className="panel pi-now">
        <div className="small muted">Your current question pack</div>
        {renaming === null ? <h2 style={{ margin: "2px 0 4px" }}>{custom ? pack.name : "None loaded"}</h2> : (
          <form className="row" style={{ margin: "4px 0" }} onSubmit={async (e) => { e.preventDefault(); const n = renaming.trim().slice(0, 60); if (!n) return; await install({ ...pack, name: n }, true); setRenaming(null); const m = `Your pack is now called "${n}".`; toast(m); onDone?.(m); }}>
            <input className="pk-in" autoFocus maxLength={60} value={renaming} onChange={(e) => setRenaming(e.target.value)} aria-label="Question pack name" style={{ minWidth: 260 }} onKeyDown={(e) => { if (e.key === "Escape") setRenaming(null); }} />
            <button className="btn primary" type="submit" disabled={!renaming.trim()}>Save name</button>
            <button className="btn soft" type="button" onClick={() => setRenaming(null)}>Cancel</button>
          </form>
        )}
        <p className="small muted" style={{ margin: 0 }}>
          {custom ? `${pack.topics.length} topics · ${pack.questions.length} practice questions · ${pack.mockTests.length} mock recipe${pack.mocks.length === 1 ? "" : "s"}` : "Practice and Mocks stay empty until you upload a pack."}
        </p>
        {custom && (
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn soft" onClick={() => setRenaming(pack.name)} disabled={renaming !== null}>Rename</button>
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
        <p className="small muted" style={{ margin: "14px 0 0" }}>Copy AI prompt: paste it into any AI chat, fill in your subject and topics, and paste the JSON it gives back in step 2.</p>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>2. Upload or paste it</h2>
        <div className="row">
          <button className="btn soft" onClick={() => fileRef.current?.click()}>Upload JSON file(s)</button>
          <input ref={fileRef} type="file" accept="application/json,.json" multiple hidden onChange={async (e) => {
            const list = [...(e.target.files ?? [])]; e.target.value = "";
            setLoadErrors([]); setMergeNotes([]); setNewName("");
            if (list.length === 0) return;
            const files = await Promise.all(list.map(async (f) => ({ name: f.name, text: await f.text() })));
            if (files.length === 1) { setText(files[0].text); return; }
            const m = mergeFiles(files, new Date(), adding ? pack : undefined);
            if (m.problems.length || !m.json) { setText(""); setLoadErrors(m.problems); return; }
            setText(m.json); setMergeNotes(m.notes);
          }} />
          {text && <button className="btn soft" onClick={() => { setText(""); setMergeNotes([]); setLoadErrors([]); setNewName(""); }}>Clear</button>}
          <span className="small muted">Pick several files at once to merge them into one pack.</span>
        </div>
        <textarea className="pi-text" spellCheck={false} placeholder='…or paste the JSON here, e.g. { "name": "My pack", "topics": [ … ], "questions": [ … ] }' value={text.length > 400_000 ? `(${(text.length / 1e6).toFixed(1)} MB file loaded, too big to show here. Check the preview below, then use it or press Clear.)` : text} readOnly={text.length > 400_000} onChange={(e) => setText(e.target.value)} />

        {loadErrors.length > 0 && (
          <div className="pi-err" role="alert">
            <b>🔴 Fix {loadErrors.length === 1 ? "this file" : `these ${loadErrors.length} files`} first. Nothing was loaded.</b>
            {loadErrors.map((f) => <div key={f.file} className="pi-file"><b>{f.file}</b><ul>{f.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>)}
          </div>
        )}
        {text && mergeNotes.length > 0 && <ul className="pi-warn">{mergeNotes.map((w, i) => <li key={i}>{w}</li>)}</ul>}
        {result && result.errors.length > 0 && (
          <div className="pi-err" role="alert"><b>🔴 Fix this first:</b><ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
        )}
        {result && result.warnings.length > 0 && <ul className="pi-warn">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}

        {p && (
          <div className="pi-ok">
            <b>✓ Looks good: {chosen}</b>
            {!adding && (
              <label className="small" style={{ display: "grid", gap: 4, margin: "6px 0" }}>Pack name (you can change it later with Rename)
                <input className="pk-in" maxLength={60} value={newName} placeholder={p.name} onChange={(e) => setNewName(e.target.value)} />
              </label>
            )}
            <p className="small" style={{ margin: "4px 0" }}>{p.topics.length} topics in {Object.keys(p.subjects).length} subject{Object.keys(p.subjects).length === 1 ? "" : "s"} · {p.questions.length} practice questions ({count("mcq")} MCQ, {count("msq")} MSQ, {count("nat")} NAT{count("str") ? `, ${count("str")} text` : ""}{count("code") ? `, ${count("code")} programming` : ""}) · {p.mockTests.length} mock test{p.mockTests.length === 1 ? "" : "s"} with {mockQs(p)} questions of their own{p.mockTests.length ? `: ${p.mockTests.map((m) => m.name).join(", ")}` : ""}{p.mocks.length ? ` · ${p.mocks.length} old-style recipe${p.mocks.length === 1 ? "" : "s"}` : ""}</p>
            <details className="bd-det" open>
              <summary>What is in this file</summary>
              <PackBreakdown pack={p} />
            </details>
            {custom && (
              <div className="pi-mode" role="radiogroup" aria-label="What to do with this file">
                <button role="radio" aria-checked={mode === "add"} className={mode === "add" ? "on" : ""} onClick={() => setMode("add")}><b>Add to my pack</b><span>Keeps everything you have and appends the new questions.</span></button>
                <button role="radio" aria-checked={mode === "replace"} className={mode === "replace" ? "on" : ""} onClick={() => setMode("replace")}><b>Replace my pack</b><span>Swaps your whole pack for this file.</span></button>
              </div>
            )}
            {adding && merged && (
              <div className="pi-merge">
                <b>After adding: {merged.pack.questions.length} practice questions, {merged.pack.mockTests.length} mock test{merged.pack.mockTests.length === 1 ? "" : "s"} ({merged.pack.topics.length} topics, {Object.keys(merged.pack.subjects).length} subjects)</b>
                {merged.report.replacedIds.length > 0 && (
                  <div className="callout" role="alert">
                    🔴 CAUTION: {merged.report.replacedIds.length} question id{merged.report.replacedIds.length === 1 ? " in this file already exists" : "s in this file already exist"} in your pack. Adding will OVERRIDE {merged.report.replacedIds.length === 1 ? "that question" : "those questions"} with the one{merged.report.replacedIds.length === 1 ? "" : "s"} from this file: <code>{merged.report.replacedIds.slice(0, 12).join(", ")}{merged.report.replacedIds.length > 12 ? ` and ${merged.report.replacedIds.length - 12} more` : ""}</code>. To check them first, open Admin, pick this profile, go to Questions and search the id.
                  </div>
                )}
                <ul>
                  {result && result.autoIds > 0 && <li>{result.autoIds} question{result.autoIds === 1 ? " had" : "s had"} no id, so the system gave {result.autoIds === 1 ? "it a new id" : "them new ids"}.</li>}
                  {merged.report.newQuestions > 0 && <li>+{merged.report.newQuestions} new practice question{merged.report.newQuestions === 1 ? "" : "s"}</li>}
                  {merged.report.updatedQuestions > 0 && <li>{merged.report.updatedQuestions} practice question{merged.report.updatedQuestions === 1 ? "" : "s"} overridden (same id)</li>}
                  {(merged.report.newMockTests > 0 || merged.report.newMockQuestions > 0) && <li>+{merged.report.newMockTests} new mock test{merged.report.newMockTests === 1 ? "" : "s"}, {merged.report.newMockQuestions} new mock question{merged.report.newMockQuestions === 1 ? "" : "s"} (mock questions stay out of Practice)</li>}
                  {merged.report.updatedMockQuestions > 0 && <li>{merged.report.updatedMockQuestions} mock question{merged.report.updatedMockQuestions === 1 ? "" : "s"} overridden (same id)</li>}
                  {(merged.report.newTopics > 0 || merged.report.newSubjects > 0) && <li>{merged.report.newTopics > 0 ? `+${merged.report.newTopics} new topic${merged.report.newTopics === 1 ? "" : "s"}` : ""}{merged.report.newTopics > 0 && merged.report.newSubjects > 0 ? ", " : ""}{merged.report.newSubjects > 0 ? `+${merged.report.newSubjects} new subject${merged.report.newSubjects === 1 ? "" : "s"}` : ""}</li>}
                  {merged.report.updatedMocks > 0 && <li>{merged.report.updatedMocks} mock test detail{merged.report.updatedMocks === 1 ? "" : "s"} updated</li>}
                  {merged.report.newMocks > 0 && <li>+{merged.report.newMocks} old-style mock recipe{merged.report.newMocks === 1 ? "" : "s"}</li>}
                  {merged.report.unchanged > 0 && <li>{merged.report.unchanged} already identical in your pack, left as they are</li>}
                  {mergeChanges(merged.report) === 0 && <li>Nothing new: this file matches what you already have.</li>}
                  {merged.report.warnings.map((w, i) => <li key={i} className="warn">{w}</li>)}
                </ul>
                <p className="small muted" style={{ margin: "4px 0 0" }}>Your practice history and mock results are kept.</p>
              </div>
            )}
            {!adding && custom && <div className="callout">🔴 CAUTION: Replacing swaps your whole pack for this file. Your mock results are kept.</div>}
            {!adding && <label className="small pi-keep"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Keep my practice history (only if the question ids match the old pack)</label>}
            <button className="btn primary" disabled={adding && !!merged && mergeChanges(merged.report) === 0} onClick={() => (adding ? addIt() : custom ? setAsk("replace") : useIt())}>{adding ? (merged && merged.report.replacedIds.length > 0 ? `Add and override ${merged.report.replacedIds.length}` : "Add to my pack") : custom ? "Replace my pack" : "Use this pack"}</button>
          </div>
        )}
      </section>
      {ask && (
        <ExportFirstModal what="question pack" action={ask} oldName={pack.name} newName={p?.name}
          onExport={() => { exportPack(pack).then((j) => downloadJson(`${fileSafe(pack.name)}.json`, j)); }}
          onGo={() => (ask === "replace" ? useIt() : (remove(), setAsk(null), toast("Pack removed.")))}
          onCancel={() => setAsk(null)} />
      )}
    </div>
  );
}
