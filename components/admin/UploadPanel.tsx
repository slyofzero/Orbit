"use client";
import { useMemo, useRef, useState } from "react";
import { saveImages } from "@/lib/imageStore";
import { PackData, mergeChanges, mergePack, parsePack } from "@/lib/packs";

// Upload a question pack JSON into this profile. A question whose id is already there is REPLACED, so this is also how you edit questions in bulk.
export default function UploadPanel({ profile, pack, save }: { profile: string; pack: PackData | null; save: (p: PackData | null) => void }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [note, setNote] = useState("");
  const [ask, setAsk] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const adding = !!pack && mode === "add";
  const result = useMemo(() => {
    if (!text.trim()) return null;
    try { return parsePack(JSON.parse(text), adding ? pack ?? undefined : undefined); } catch (e) { return { pack: null, errors: [`This is not valid JSON: ${(e as Error).message}`], warnings: [], autoIds: 0, images: {} as Record<string, string> }; }
  }, [text, adding, pack]);
  const p = result?.pack ?? null;
  const merged = useMemo(() => (p && pack ? mergePack(pack, p) : null), [p, pack]);
  const r = merged?.report;

  const apply = async () => {
    if (!p || !result) return;
    await saveImages(result.images, profile);
    if (adding && merged) { save(merged.pack); setNote(`Done: ${r!.newQuestions + r!.newMockQuestions} added, ${r!.updatedQuestions + r!.updatedMockQuestions} replaced.`); }
    else { save(p); setNote(`"${p.name}" is now this profile's pack.`); }
    setText(""); setAsk(false);
  };
  const big = text.length > 400_000;

  return (
    <>
      <p className="muted">Questions without an id get one from the system. A question that carries an id already in this profile <b>overrides</b> the old one (you get a warning first).</p>
      <div className="row">
        <button className="btn soft" onClick={() => file.current?.click()}>Choose a .json file</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setText(await f.text()); }} />
        {text && <button className="btn soft" onClick={() => setText("")}>Clear</button>}
      </div>
      <textarea className="pi-text pk-json" spellCheck={false} placeholder="…or paste the JSON here" readOnly={big} onChange={(e) => setText(e.target.value)}
        value={big ? `(${(text.length / 1e6).toFixed(1)} MB file loaded. Check the preview below.)` : text} />
      {result && result.errors.length > 0 && <div className="pi-err" role="alert"><b>🔴 Fix this first:</b><ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
      {result && result.warnings.length > 0 && <ul className="pi-warn">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
      {p && (
        <div className="panel">
          {pack && (
            <div className="pi-mode" role="radiogroup">
              <button role="radio" aria-checked={mode === "add"} className={mode === "add" ? "on" : ""} onClick={() => setMode("add")}><b>Add or update</b><span>New ids are added, existing ids are replaced.</span></button>
              <button role="radio" aria-checked={mode === "replace"} className={mode === "replace" ? "on" : ""} onClick={() => setMode("replace")}><b>Replace the whole pack</b><span>Swaps everything for this file.</span></button>
            </div>
          )}
          {adding && r ? (
            <>
            {r.replacedIds.length > 0 && (
              <div className="callout" role="alert">
                🔴 CAUTION: {r.replacedIds.length} id{r.replacedIds.length === 1 ? " in this file already exists" : "s in this file already exist"} in this profile. Applying will OVERRIDE {r.replacedIds.length === 1 ? "that question" : "those questions"}: <code>{r.replacedIds.slice(0, 12).join(", ")}{r.replacedIds.length > 12 ? ` and ${r.replacedIds.length - 12} more` : ""}</code>. Search an id in the Questions tab to see what is there now.
              </div>
            )}
            <ul className="pk-sum">
              {result && result.autoIds > 0 && <li>{result.autoIds} question{result.autoIds === 1 ? " had" : "s had"} no id, so the system gave {result.autoIds === 1 ? "it a new id" : "them new ids"}.</li>}
              <li>{r.newQuestions} new practice, {r.newMockQuestions} new mock question{r.newMockQuestions === 1 ? "" : "s"}{r.newMockTests ? ` (${r.newMockTests} new mock test${r.newMockTests === 1 ? "" : "s"})` : ""}</li>
              <li>{r.updatedQuestions + r.updatedMockQuestions} replaced (same id), {r.unchanged} identical</li>
              {(r.newTopics > 0 || r.newSubjects > 0) && <li>+{r.newTopics} topics, +{r.newSubjects} subjects</li>}
              {r.warnings.map((w, i) => <li key={i} className="warn">{w}</li>)}
            </ul>
            </>
          ) : <p className="small">{p.questions.length} practice questions, {p.mockTests.length} mock tests, {p.topics.length} topics.</p>}
          {!adding && pack && <div className="callout">🔴 CAUTION: this removes every question and topic the profile has now.</div>}
          {!adding && pack && !ask ? <button className="btn primary" onClick={() => setAsk(true)}>Replace the pack</button>
            : <button className="btn primary" disabled={adding && !!r && mergeChanges(r) === 0} onClick={apply}>{adding ? (r && r.replacedIds.length ? `Apply and override ${r.replacedIds.length}` : "Apply to this profile") : pack ? "Yes, replace it" : "Use this pack"}</button>}
          {adding && r && mergeChanges(r) === 0 && <span className="small muted"> Nothing to change.</span>}
        </div>
      )}
      {note && <p className="small pk-note">{note}</p>}
    </>
  );
}
