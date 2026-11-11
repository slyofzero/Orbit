"use client";
import { useState } from "react";
import { FixedMock, PackData } from "@/lib/packs";
import MockDetail from "./MockDetail";

const ID = /^[A-Za-z0-9_.-]{1,48}$/;

function Card({ m, onSave, onDelete, onOpen }: { m: FixedMock; onSave: (m: FixedMock) => void; onDelete: () => void; onOpen: () => void }) {
  const [name, setName] = useState(m.name);
  const [minutes, setMinutes] = useState(String(m.minutes));
  const [note, setNote] = useState(m.note ?? "");
  const [ask, setAsk] = useState(false);
  const qs = m.sections.reduce((n, s) => n + s.questions.length, 0);
  const mins = Number(minutes);
  const dirty = name !== m.name || mins !== m.minutes || note !== (m.note ?? "");
  return (
    <div className="pk-card static">
      <div className="small muted"><code>{m.id}</code> · {qs} question{qs === 1 ? "" : "s"} in {m.sections.length} section{m.sections.length === 1 ? "" : "s"}: {m.sections.map((s) => `${s.name} (${s.questions.length})`).join(", ") || "empty"}</div>
      <label>Name<input className="pk-in" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="pk-two">
        <label>Minutes<input className="pk-in" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
        <label>Note on the card<input className="pk-in" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </div>
      <div className="row">
        <button className="btn primary" onClick={onOpen}>Open questions ({qs})</button>
        <button className="btn soft" disabled={!dirty || !name.trim() || !(mins >= 5 && mins <= 600)} onClick={() => onSave({ ...m, name: name.trim(), minutes: Math.round(mins), note: note.trim() || undefined })}>Save details</button>
        {ask ? <>Delete this mock and its {qs} questions? <button className="btn primary" onClick={onDelete}>Yes, delete</button> <button className="btn soft" onClick={() => setAsk(false)}>No</button></> : <button className="btn soft" onClick={() => setAsk(true)}>Delete mock test</button>}
      </div>
    </div>
  );
}

export default function MocksPanel({ profile, pack, save }: { profile: string; pack: PackData; save: (p: PackData) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("180");
  const [err, setErr] = useState("");
  const add = () => {
    const mid = id.trim(), mins = Number(minutes);
    if (!ID.test(mid)) return setErr("The id must be short and use letters, digits, - or _.");
    if (pack.mockTests.some((m) => m.id === mid) || pack.mocks.some((m) => m.id === mid)) return setErr(`There is already a mock "${mid}".`);
    if (!name.trim()) return setErr("Give the mock a name.");
    if (!(mins >= 5 && mins <= 600)) return setErr("Minutes must be from 5 to 600.");
    save({ ...pack, mockTests: [...pack.mockTests, { id: mid, name: name.trim(), minutes: Math.round(mins), sections: [] }] });
    setId(""); setName(""); setErr("");
  };
  if (open) return <MockDetail profile={profile} pack={pack} mockId={open} save={save} onBack={() => setOpen(null)} />;
  return (
    <>
      <p className="muted">Each mock test owns its questions. Open a mock to edit its sections and questions.</p>
      <div className="pk-grid">
        {pack.mockTests.map((m) => <Card key={m.id + m.name + m.minutes} m={m} onSave={(n) => save({ ...pack, mockTests: pack.mockTests.map((x) => (x.id === m.id ? n : x)) })} onDelete={() => save({ ...pack, mockTests: pack.mockTests.filter((x) => x.id !== m.id) })} onOpen={() => setOpen(m.id)} />)}
        {pack.mockTests.length === 0 && <p className="muted">No mock tests yet.</p>}
      </div>
      <h3>Add a mock test</h3>
      <div className="pk-bar">
        <input className="pk-in" placeholder="id, e.g. mock3" value={id} onChange={(e) => setId(e.target.value)} spellCheck={false} />
        <input className="pk-in" placeholder="Name, e.g. Mock test 3" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="pk-in" style={{ maxWidth: 110 }} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutes" />
        <button className="btn primary" onClick={add}>Add mock test</button>
      </div>
      {err && <p className="pi-err" role="alert">{err}</p>}
      {pack.mocks.length > 0 && (
        <>
          <h3>Old-style recipes</h3>
          <p className="small muted">These build a test by drawing from the practice questions.</p>
          {pack.mocks.map((m) => <div key={m.id} className="row"><code>{m.id}</code> {m.name} <button className="btn soft" onClick={() => save({ ...pack, mocks: pack.mocks.filter((x) => x.id !== m.id) })}>Delete</button></div>)}
        </>
      )}
    </>
  );
}
