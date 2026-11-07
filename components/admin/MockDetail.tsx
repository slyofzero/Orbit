"use client";
import { useState } from "react";
import { plain } from "@/components/stats/useStats";
import { Loc, PackData, allQuestions } from "@/lib/packs";
import { deleteSection, moveQuestion, moveSection, removeQuestion, renameSection } from "@/lib/packEdit";
import QuestionEditor from "./QuestionEditor";

type Edit = { loc: Loc } | { preset: { mockId: string; section: string } } | null;

/** Inside one mock test: its sections and questions, in the order they appear in the exam. */
export default function MockDetail({ profile, pack, mockId, save, onBack }: { profile: string; pack: PackData; mockId: string; save: (p: PackData) => void; onBack: () => void }) {
  const mock = pack.mockTests.find((m) => m.id === mockId);
  const [edit, setEdit] = useState<Edit>(null);
  const [confirm, setConfirm] = useState<string | null>(null); // "q:<id>" or "s:<section>"
  const [newSec, setNewSec] = useState("");
  const [msg, setMsg] = useState("");
  if (!mock) return <p className="muted">That mock test is gone. <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>Back</a></p>;

  const qs = mock.sections.reduce((n, s) => n + s.questions.length, 0);
  const marks = mock.sections.reduce((n, s) => n + s.questions.reduce((a, q) => a + q.marks, 0), 0);
  const topicName = (id: string) => pack.topics.find((t) => t.id === id)?.name ?? id;
  const openEdit = (id: string) => { const loc = allQuestions(pack).find((l) => l.q.id === id); if (loc) setEdit({ loc }); };

  const addSection = () => {
    const name = newSec.trim().slice(0, 60);
    if (!name) return;
    if (mock.sections.some((s) => s.name === name)) return setMsg(`This mock already has a section called "${name}".`);
    save({ ...pack, mockTests: pack.mockTests.map((m) => (m.id === mockId ? { ...m, sections: [...m.sections, { name, questions: [] }] } : m)) });
    setNewSec(""); setMsg("");
  };

  return (
    <>
      <p className="small"><a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>← All mock tests</a></p>
      <h2 style={{ marginTop: 4 }}>{mock.name}</h2>
      <p className="muted"><code>{mock.id}</code> · {qs} questions, {marks} marks, {mock.minutes} minutes. Questions run in the order shown here. Each one has its own id, unique across Practice and every mock test.</p>
      {msg && <p className="pi-err" role="alert">{msg}</p>}

      {mock.sections.map((sec, si) => (
        <section key={sec.name} className="panel ad-sec">
          <div className="ad-bar">
            <input className="ad-in" defaultValue={sec.name} aria-label="Section name" onBlur={(e) => {
              if (e.target.value.trim() === sec.name) return;
              const r = renameSection(pack, mockId, sec.name, e.target.value);
              if (typeof r === "string") { setMsg(r); e.target.value = sec.name; } else { setMsg(""); save(r); }
            }} />
            <button className="btn soft" disabled={si === 0} onClick={() => save(moveSection(pack, mockId, sec.name, -1))} aria-label="Move section up">↑</button>
            <button className="btn soft" disabled={si === mock.sections.length - 1} onClick={() => save(moveSection(pack, mockId, sec.name, 1))} aria-label="Move section down">↓</button>
            <button className="btn primary" onClick={() => setEdit({ preset: { mockId, section: sec.name } })} disabled={pack.topics.length === 0}>+ Add question</button>
            {confirm === `s:${sec.name}` ? <>Delete section and its {sec.questions.length} questions? <button className="btn primary" onClick={() => { save(deleteSection(pack, mockId, sec.name)); setConfirm(null); }}>Yes</button> <button className="btn soft" onClick={() => setConfirm(null)}>No</button></>
              : <button className="btn soft" onClick={() => setConfirm(`s:${sec.name}`)}>Delete section</button>}
          </div>
          <table className="t ad-table">
            <thead><tr><th>#</th><th>Id</th><th>Topic</th><th>Type</th><th>Question</th><th /></tr></thead>
            <tbody>
              {sec.questions.map((q, qi) => (
                <tr key={q.id}>
                  <td className="muted">{qi + 1}</td>
                  <td><code>{q.id}</code></td>
                  <td>{topicName(q.topic)}</td>
                  <td>{q.type.toUpperCase()} · {q.marks}m</td>
                  <td className="ad-text">{plain(q.text, 80)}</td>
                  <td className="ad-act">
                    {confirm === `q:${q.id}` ? <>Delete? <button className="btn primary" onClick={() => { save(removeQuestion(pack, q.id)); setConfirm(null); }}>Yes</button> <button className="btn soft" onClick={() => setConfirm(null)}>No</button></>
                      : <>
                        <button className="btn soft" disabled={qi === 0} onClick={() => save(moveQuestion(pack, mockId, sec.name, q.id, -1))} aria-label={`Move ${q.id} up`}>↑</button>{" "}
                        <button className="btn soft" disabled={qi === sec.questions.length - 1} onClick={() => save(moveQuestion(pack, mockId, sec.name, q.id, 1))} aria-label={`Move ${q.id} down`}>↓</button>{" "}
                        <button className="btn soft" onClick={() => openEdit(q.id)}>Edit</button>{" "}
                        <button className="btn soft" onClick={() => setConfirm(`q:${q.id}`)}>Delete</button>
                      </>}
                  </td>
                </tr>
              ))}
              {sec.questions.length === 0 && <tr><td colSpan={6} className="muted">No questions in this section yet.</td></tr>}
            </tbody>
          </table>
        </section>
      ))}
      {mock.sections.length === 0 && <p className="muted">This mock has no sections yet. Add one to start adding questions.</p>}

      <h3>Add a section</h3>
      <div className="ad-bar">
        <input className="ad-in" placeholder="e.g. General Aptitude" value={newSec} onChange={(e) => setNewSec(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSection(); }} />
        <button className="btn primary" onClick={addSection} disabled={!newSec.trim()}>Add section</button>
      </div>

      {edit && (
        <QuestionEditor profile={profile} pack={pack} loc={"loc" in edit ? edit.loc : null} preset={"preset" in edit ? edit.preset : undefined}
          onClose={() => setEdit(null)} onSave={(next, id) => { save(next); setEdit(null); setMsg(""); void id; }} />
      )}
    </>
  );
}
