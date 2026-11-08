"use client";
import { useRef, useState } from "react";
import Rich from "@/components/Rich";
import { loadImages, saveImages } from "@/lib/imageStore";
import { DATA_IMG, MAX_IMAGE, hashData, storedImageNames } from "@/lib/images";
import { Loc, PackData, allQuestions } from "@/lib/packs";
import { Target, checkQuestion, freeId, upsertQuestion } from "@/lib/packEdit";
import { QType } from "@/lib/types";
import { CODE_LANGUAGES, LANGUAGE_LABEL } from "@/lib/codeLanguages";

type Field = "text" | "explanation" | `opt${number}`;

/** Adds or edits one question. It runs the same checks as an upload, so a broken question can't be saved. */
export default function QuestionEditor({ profile, pack, loc, preset, onClose, onSave }: {
  profile: string; pack: PackData; loc: Loc | null; preset?: { mockId: string; section: string }; onClose: () => void; onSave: (next: PackData, id: string) => void;
}) {
  const q = loc?.q;
  const firstTopic = q?.topic ?? pack.topics[0]?.id ?? "";
  const [topic, setTopic] = useState(firstTopic);
  const [type, setType] = useState<QType>(q?.type ?? "mcq");
  const [marks, setMarks] = useState<1 | 2>(q?.marks ?? 1);
  const [text, setText] = useState(q?.text ?? "");
  const [explanation, setExplanation] = useState(q?.explanation ?? "");
  const [options, setOptions] = useState<string[]>(q?.options ?? ["", "", "", ""]);
  const [picked, setPicked] = useState<number[]>(q ? (q.type === "mcq" ? [q.answer as number] : q.type === "msq" ? (q.answer as number[]) : []) : [0]);
  const [natValue, setNatValue] = useState(q?.type === "nat" ? String((q.answer as { value: number }).value) : "");
  const [natTol, setNatTol] = useState(q?.type === "nat" ? String((q.answer as { tol: number }).tol) : "0");
  const [language, setLanguage] = useState<string>(q?.code?.language ?? "python");
  const [starter, setStarter] = useState(q?.code?.starter ?? "");
  const [solution, setSolution] = useState(q?.code?.solution ?? "");
  const [setup, setSetup] = useState(q?.code?.setup ?? "");
  const [limit, setLimit] = useState(q?.code?.timeLimitMs ? String(q.code.timeLimitMs) : "");
  const [testsJson, setTestsJson] = useState(JSON.stringify(q?.code?.tests ?? [{ input: "", output: "" }], null, 2));
  const [tags, setTags] = useState((q?.tags ?? []).join(", "));
  const [where, setWhere] = useState<string>(loc ? (loc.bank === "practice" ? "practice" : `mock:${loc.mockId}`) : preset ? `mock:${preset.mockId}` : "practice");
  const [section, setSection] = useState(loc?.section ?? preset?.section ?? "");
  const [newSec, setNewSec] = useState(false);
  // the system assigns ids: a new question gets the next free one, an existing question keeps its own
  const id = q?.id ?? freeId(pack, where.startsWith("mock:") ? where.slice(5) : topic);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const last = useRef<Field>("text");
  const file = useRef<HTMLInputElement>(null);

  const mock = where.startsWith("mock:") ? pack.mockTests.find((m) => m.id === where.slice(5)) : undefined;
  const sections = mock?.sections.map((s) => s.name) ?? [];
  const useNewSec = sections.length === 0 || newSec;
  const sectionName = (mock ? (useNewSec ? section : section || sections[0] || "") : "").trim();

  const pickTopic = (t: string) => setTopic(t);
  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, k) => (k === i ? v : x)));
  const toggle = (i: number) => setPicked((p) => (type === "mcq" ? [i] : p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort()));
  const dropOption = (i: number) => { setOptions((o) => o.filter((_, k) => k !== i)); setPicked((p) => p.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x))); };

  const insertPicture = async (f: File) => {
    const data: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
    if (!DATA_IMG.test(data)) { setErrors(["That file is not a png, jpeg, webp, gif or svg picture."]); return; }
    if (data.length > MAX_IMAGE) { setErrors([`That picture is too big (${(data.length / 1e6).toFixed(1)} MB). Keep it under ${(MAX_IMAGE / 1e6).toFixed(0)} MB.`]); return; }
    const h = hashData(data);
    await saveImages({ [h]: data }, profile);
    const tag = `\n![${f.name.replace(/\.[^.]+$/, "").replace(/[\]\n]/g, "")}](img:${h})`;
    const field = last.current;
    if (field === "explanation") setExplanation((v) => v + tag);
    else if (field.startsWith("opt")) { const i = Number(field.slice(3)); setOptions((o) => o.map((x, k) => (k === i ? x + tag.trim() : x))); }
    else setText((v) => v + tag);
    setErrors([]);
  };

  const submit = async () => {
    setBusy(true);
    const errs: string[] = [];
    const cleanId = id.trim();
    if (!loc && allQuestions(pack).some((l) => l.q.id === cleanId)) errs.push(`The id "${cleanId}" is already used by another question. Ids must be unique across Practice and every mock test.`);
    if (where.startsWith("mock:") && !mock) errs.push("Pick a mock test.");
    if (mock && !sectionName) errs.push("Give the mock section a name.");
    const raw: Record<string, unknown> = {
      id: cleanId, subject: pack.topics.find((t) => t.id === topic)?.subject, topic, type, marks, text, explanation,
      ...(tags.trim() ? { tags: tags.split(",").map((t) => t.trim()).filter(Boolean) } : {}),
    };
    if (type === "code") {
      let tests: unknown;
      try { tests = JSON.parse(testsJson); } catch (e) { errs.push(`The tests are not valid JSON: ${(e as Error).message}`); }
      Object.assign(raw, { language, tests, ...(starter ? { starter } : {}), ...(solution ? { solution } : {}), ...(setup.trim() ? { setup } : {}), ...(limit.trim() ? { timeLimitMs: Number(limit) } : {}) });
    } else if (type === "nat") { raw.answer = natValue.trim() === "" ? undefined : Number(natValue); raw.tolerance = Number(natTol || 0); }
    else { raw.options = options; raw.answer = type === "mcq" ? (picked[0] ?? -1) : picked; }
    const names = [...new Set([text, explanation, ...(type === "nat" || type === "code" ? [] : options)].flatMap(storedImageNames))];
    const images = names.length ? await loadImages(names, profile) : {};
    const res = checkQuestion(pack, raw, images);
    errs.push(...res.errors);
    if (errs.length || !res.question) { setErrors(errs); setBusy(false); return; }
    const target: Target = mock ? { bank: "mock", mockId: mock.id, section: sectionName } : { bank: "practice" };
    try { onSave(upsertQuestion(pack, res.question, target), res.question.id); } catch (e) { setErrors([(e as Error).message]); setBusy(false); }
  };

  return (
    <div className="ad-veil" role="dialog" aria-modal="true" aria-label={loc ? `Edit ${loc.q.id}` : "Add question"}>
      <div className="ad-modal">
        <h2 style={{ marginTop: 0 }}>{loc ? <>Edit <code>{loc.q.id}</code></> : "Add a question"}</h2>
        <div className="ad-form">
          <label>Id <span className="small muted">({loc ? "fixed" : "assigned by the system"})</span><input className="ad-in" value={id} disabled spellCheck={false} />
            <span className="small muted">{loc ? "Saving changes overrides this question. Its id stays the same." : "Every question gets its own unique id automatically."}</span></label>
          <label>Topic<select value={topic} onChange={(e) => pickTopic(e.target.value)}>
            {pack.topics.map((t) => <option key={t.id} value={t.id}>{pack.subjects[t.subject] ?? t.subject}: {t.name}</option>)}</select></label>
          <label>Bank<select value={where} onChange={(e) => { setWhere(e.target.value); setSection(""); setNewSec(false); }}>
            <option value="practice">Practice</option>
            {pack.mockTests.map((m) => <option key={m.id} value={`mock:${m.id}`}>Mock: {m.name}</option>)}</select></label>
          {mock && (
            <label>Section of the mock
              {sections.length > 0 && (
                <select value={useNewSec ? "__new__" : section || sections[0]} onChange={(e) => { if (e.target.value === "__new__") { setNewSec(true); setSection(""); } else { setNewSec(false); setSection(e.target.value); } }}>
                  {sections.map((x) => <option key={x} value={x}>{x}</option>)}<option value="__new__">New section…</option>
                </select>
              )}
              {useNewSec && <input className="ad-in" placeholder="Section name, e.g. General Aptitude" value={section} onChange={(e) => setSection(e.target.value)} />}
            </label>
          )}
          <div className="ad-two">
            <label>Type<select value={type} onChange={(e) => { const t = e.target.value as QType; setType(t); setPicked(t === "mcq" ? picked.slice(0, 1).length ? picked.slice(0, 1) : [0] : picked); }}>
              <option value="mcq">MCQ (one right option)</option><option value="msq">MSQ (several right options)</option><option value="nat">NAT (typed number)</option><option value="code">Programming (write code, Practice only)</option></select></label>
            <label>Marks<select value={marks} onChange={(e) => setMarks(Number(e.target.value) as 1 | 2)}><option value={1}>1</option><option value={2}>2</option></select></label>
          </div>
          <label>Question <span className="small muted">(LaTeX between $…$, pictures with the button below)</span>
            <textarea className="ad-ta" rows={5} value={text} onFocus={() => (last.current = "text")} onChange={(e) => setText(e.target.value)} spellCheck={false} /></label>
          {text.trim() && <div className="ad-prev"><Rich text={text} /></div>}

          {type === "code" ? (
            <>
              <div className="ad-two">
                <label>Language<select value={language} onChange={(e) => setLanguage(e.target.value)}>{CODE_LANGUAGES.map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}</select></label>
                <label>Time limit per test (ms, optional)<input className="ad-in" inputMode="numeric" placeholder="3000" value={limit} onChange={(e) => setLimit(e.target.value)} /></label>
              </div>
              <label>Setup needed <span className="small muted">(optional: exact files, folders or tables that must exist; shows a "Copy setup prompt" button)</span><textarea className="ad-ta" rows={3} value={setup} onChange={(e) => setSetup(e.target.value)} spellCheck={false} /></label>
              <label>Starter code <span className="small muted">(optional)</span><textarea className="ad-ta" rows={4} value={starter} onChange={(e) => setStarter(e.target.value)} spellCheck={false} /></label>
              <label>Reference solution <span className="small muted">(shown after Submit or Skip)</span><textarea className="ad-ta" rows={5} value={solution} onChange={(e) => setSolution(e.target.value)} spellCheck={false} /></label>
              <label>Tests <span className="small muted">(JSON list of {"{"} "input", "output", "hidden"? {"}"}; at least one visible)</span><textarea className="ad-ta" rows={7} value={testsJson} onChange={(e) => setTestsJson(e.target.value)} spellCheck={false} /></label>
            </>
          ) : type === "nat" ? (
            <div className="ad-two">
              <label>Right answer (a number)<input className="ad-in" inputMode="decimal" value={natValue} onChange={(e) => setNatValue(e.target.value)} /></label>
              <label>Allowed error (±)<input className="ad-in" inputMode="decimal" value={natTol} onChange={(e) => setNatTol(e.target.value)} /></label>
            </div>
          ) : (
            <div>
              <div className="small muted">Options. Tick the right {type === "mcq" ? "one" : "ones"}.</div>
              {options.map((o, i) => (
                <div key={i} className="ad-opt">
                  <input type={type === "mcq" ? "radio" : "checkbox"} name="right" checked={picked.includes(i)} onChange={() => toggle(i)} aria-label={`Option ${String.fromCharCode(65 + i)} is right`} />
                  <b>{String.fromCharCode(65 + i)}</b>
                  <input className="ad-in" value={o} onFocus={() => (last.current = `opt${i}`)} onChange={(e) => setOpt(i, e.target.value)} spellCheck={false} />
                  {/(!\[|\$)/.test(o) && <span className="ad-optprev"><Rich text={o} /></span>}
                  {options.length > 2 && <button className="btn soft" onClick={() => dropOption(i)} aria-label={`Remove option ${String.fromCharCode(65 + i)}`}>✕</button>}
                </div>
              ))}
              {options.length < 8 && <button className="btn soft" onClick={() => setOptions((o) => [...o, ""])}>+ Add option</button>}
            </div>
          )}

          <label>Explanation<textarea className="ad-ta" rows={3} value={explanation} onFocus={() => (last.current = "explanation")} onChange={(e) => setExplanation(e.target.value)} spellCheck={false} /></label>
          <label>Tags <span className="small muted">(optional, separated by commas)</span><input className="ad-in" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="formula, hard" /></label>
          <div className="row">
            <button className="btn soft" onClick={() => file.current?.click()}>Add picture…</button>
            <span className="small muted">It goes into the field you last clicked.</span>
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await insertPicture(f); }} />
          </div>
        </div>
        {errors.length > 0 && <div className="pi-err" role="alert"><b>🔴 Fix this first:</b><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={busy} onClick={submit}>{loc ? "Save changes" : "Add question"}</button>
          <button className="btn soft" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
