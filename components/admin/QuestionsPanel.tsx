"use client";
import { useEffect, useMemo, useState } from "react";
import { Loc, PackData, allQuestions } from "@/lib/packs";
import { plain } from "@/components/stats/useStats";
import QuestionEditor from "./QuestionEditor";

type Props = { profile: string; pack: PackData; save: (p: PackData | null) => void; focusId: string | null };
const PAGE = 40;

export default function QuestionsPanel({ profile, pack, save, focusId }: Props) {
  const [needle, setNeedle] = useState(focusId ?? "");
  const [bank, setBank] = useState("all"); // all | practice | mock:<id>
  const [topic, setTopic] = useState("");
  const [show, setShow] = useState(PAGE);
  const [edit, setEdit] = useState<Loc | "new" | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const all = useMemo(() => allQuestions(pack), [pack]);

  useEffect(() => {
    if (!focusId) return;
    const l = all.find((x) => x.q.id === focusId);
    if (l) setEdit(l);
  }, [focusId]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = needle.trim().toLowerCase();
  const rows = all.filter((l) =>
    (bank === "all" || (bank === "practice" ? l.bank === "practice" : l.mockId === bank.slice(5))) &&
    (!topic || l.q.topic === topic) &&
    (!n || l.q.id.toLowerCase().includes(n) || l.q.text.toLowerCase().includes(n)));
  rows.sort((a, b) => Number(b.q.id.toLowerCase() === n) - Number(a.q.id.toLowerCase() === n));
  const topicName = (id: string) => pack.topics.find((t) => t.id === id)?.name ?? id;

  const remove = (id: string) => {
    save({
      ...pack,
      questions: pack.questions.filter((q) => q.id !== id),
      mockTests: pack.mockTests.map((m) => ({ ...m, sections: m.sections.map((s) => ({ ...s, questions: s.questions.filter((q) => q.id !== id) })).filter((s) => s.questions.length) })),
    });
    setConfirm(null); setNote(`Deleted ${id}.`);
  };

  return (
    <>
      <div className="pk-bar">
        <input className="pk-in" value={needle} onChange={(e) => { setNeedle(e.target.value); setShow(PAGE); }} placeholder="Find by id or text, e.g. alg-3" spellCheck={false} />
        <select value={bank} onChange={(e) => { setBank(e.target.value); setShow(PAGE); }}>
          <option value="all">All questions</option>
          <option value="practice">Practice only</option>
          {pack.mockTests.map((m) => <option key={m.id} value={`mock:${m.id}`}>Mock: {m.name}</option>)}
        </select>
        <select value={topic} onChange={(e) => { setTopic(e.target.value); setShow(PAGE); }}>
          <option value="">All topics</option>
          {pack.topics.map((t) => <option key={t.id} value={t.id}>{pack.subjects[t.subject] ?? t.subject}: {t.name}</option>)}
        </select>
        <button className="btn primary" onClick={() => setEdit("new")} disabled={pack.topics.length === 0}>+ Add question</button>
      </div>
      {pack.topics.length === 0 && <p className="small muted">Add a topic first (Topics tab). Every question needs one.</p>}
      {note && <p className="small pk-note">{note}</p>}
      <p className="small muted">{rows.length} of {all.length} questions. Every question has one id that is unique across Practice and all mock tests.</p>

      <table className="t pk-table pk-qtable">
        <colgroup><col className="c-id" /><col className="c-bank" /><col className="c-topic" /><col className="c-type" /><col /><col className="c-act" /></colgroup>
        <thead><tr><th>Id</th><th>Bank</th><th>Topic</th><th>Type</th><th>Question</th><th /></tr></thead>
        <tbody>
          {rows.slice(0, show).map((l) => (
            <tr key={l.q.id}>
              <td><code>{l.q.id}</code></td>
              <td className="muted pk-bank" title={l.bank === "practice" ? "Practice" : `${l.mockName} · ${l.section}`}>{l.bank === "practice" ? "Practice" : `${l.mockName} · ${l.section}`}</td>
              <td>{topicName(l.q.topic)}</td>
              <td className="pk-type">{l.q.type.toUpperCase()} · {l.q.marks}m</td>
              <td className="pk-text">{plain(l.q.text, 90)}</td>
              <td className="pk-act">
                {confirm === l.q.id ? (
                  <>Delete? <button className="btn primary" onClick={() => remove(l.q.id)}>Yes</button> <button className="btn soft" onClick={() => setConfirm(null)}>No</button></>
                ) : (
                  <><button className="btn soft" onClick={() => setEdit(l)}>Edit</button> <button className="btn soft" onClick={() => setConfirm(l.q.id)}>Delete</button></>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="muted">Nothing matches.</td></tr>}
        </tbody>
      </table>
      {rows.length > show && <button className="btn soft" onClick={() => setShow((s) => s + PAGE)}>Show more</button>}

      {edit && (
        <QuestionEditor profile={profile} pack={pack} loc={edit === "new" ? null : edit} onClose={() => setEdit(null)}
          onSave={(next, id) => { save(next); setEdit(null); setNote(`Saved ${id}.`); }} />
      )}
    </>
  );
}
