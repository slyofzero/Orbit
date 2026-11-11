"use client";
import { useState } from "react";
import { PackData, allQuestions } from "@/lib/packs";
import { TopicStatus } from "@/lib/types";

const ID = /^[A-Za-z0-9_.-]{1,48}$/;
const STATUS: [TopicStatus, string][] = [["know", "I know it"], ["shaky", "Shaky"], ["noidea", "No idea"]];

export default function TopicsPanel({ pack, save }: { pack: PackData; save: (p: PackData) => void }) {
  const used = new Map<string, number>();
  for (const l of allQuestions(pack)) used.set(l.q.topic, (used.get(l.q.topic) ?? 0) + 1);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState(Object.keys(pack.subjects)[0] ?? "");
  const [newSubject, setNewSubject] = useState("");
  const [err, setErr] = useState("");
  const subjectIds = Object.keys(pack.subjects);
  const useNew = subjectIds.length === 0 || subject === "__new__";

  const add = () => {
    const tid = id.trim(), sid = useNew ? newSubject.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : subject;
    if (!ID.test(tid)) return setErr("The topic id must be short and use letters, digits, - or _.");
    if (pack.topics.some((t) => t.id === tid)) return setErr(`There is already a topic "${tid}".`);
    if (!name.trim()) return setErr("Give the topic a name.");
    if (!sid || !ID.test(sid)) return setErr("Pick a subject, or type a name for a new one.");
    const subjects = sid in pack.subjects ? pack.subjects : { ...pack.subjects, [sid]: newSubject.trim() || sid };
    save({ ...pack, subjects, topics: [...pack.topics, { id: tid, subject: sid, name: name.trim(), status: "know" }] });
    setId(""); setName(""); setNewSubject(""); setErr("");
  };
  const patch = (tid: string, p: Partial<PackData["topics"][number]>) => save({ ...pack, topics: pack.topics.map((t) => (t.id === tid ? { ...t, ...p } : t)) });

  return (
    <>
      <h2>Subjects</h2>
      <div className="pk-chips">
        {subjectIds.map((s) => (
          <label key={s} className="pk-chip"><code>{s}</code>
            <input className="pk-in" defaultValue={pack.subjects[s]} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== pack.subjects[s]) save({ ...pack, subjects: { ...pack.subjects, [s]: v } }); }} /></label>
        ))}
      </div>
      <h2>Topics</h2>
      <table className="t pk-table">
        <thead><tr><th>Id</th><th>Subject</th><th>Name</th><th>Status</th><th>Questions</th><th /></tr></thead>
        <tbody>
          {pack.topics.map((t) => (
            <tr key={t.id}>
              <td><code>{t.id}</code></td>
              <td>{pack.subjects[t.subject] ?? t.subject}</td>
              <td><input className="pk-in" defaultValue={t.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.name) patch(t.id, { name: v }); }} /></td>
              <td><select value={t.status} onChange={(e) => patch(t.id, { status: e.target.value as TopicStatus })}>{STATUS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
              <td>{used.get(t.id) ?? 0}</td>
              <td>{(used.get(t.id) ?? 0) === 0 ? <button className="btn soft" onClick={() => save({ ...pack, topics: pack.topics.filter((x) => x.id !== t.id) })}>Delete</button> : <span className="small muted">in use</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Add a topic</h3>
      <div className="pk-bar">
        <input className="pk-in" placeholder="id, e.g. algebra" value={id} onChange={(e) => setId(e.target.value)} spellCheck={false} />
        <input className="pk-in" placeholder="Name, e.g. Algebra" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={useNew ? "__new__" : subject} onChange={(e) => setSubject(e.target.value)}>
          {subjectIds.map((s) => <option key={s} value={s}>{pack.subjects[s]}</option>)}<option value="__new__">New subject…</option>
        </select>
        {useNew && <input className="pk-in" placeholder="New subject name" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />}
        <button className="btn primary" onClick={add}>Add topic</button>
      </div>
      {err && <p className="pi-err" role="alert">{err}</p>}
      <p className="small muted">A topic can only be deleted when no question uses it.</p>
    </>
  );
}
