"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import CodeLangPill from "@/components/CodeLangPill";
import QuestionCard from "@/components/QuestionCard";
import { KEYS, usePack, usePersisted } from "@/lib/store";
import { PracticeRec } from "@/lib/types";

// One programming question on a page of its own: nothing else is shown.
export default function ProgrammingQuestion() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id ?? "");
  const { pack, topicById, subjects, ready: packReady } = usePack();
  const [practice, setPractice, ready] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [, setFixed] = usePersisted<Record<string, boolean>>(KEYS.fixed, {});
  const all = useMemo(() => pack.questions.filter((q) => q.type === "code"), [pack]);
  const i = all.findIndex((q) => q.id === id);
  const q = all[i];

  if (!packReady || !ready) return <p className="muted">Loading…</p>;
  if (!q) {
    return (
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>That programming question is not in your pack</h2>
        <p className="muted">It may have been removed or renamed.</p>
        <Link className="btn primary" href="/practice/programming">Back to programming questions</Link>
      </div>
    );
  }
  const sid = q.subject ?? topicById[q.topic]?.subject ?? "";
  const prev = all[i - 1], next = all[i + 1];
  const rec = practice[q.id];
  return (
    <div className="pq-page">
      <div className="pq-top">
        <Link className="btn soft" href="/practice/programming">← All programming questions</Link>
        <span className="small muted">Question {i + 1} of {all.length}</span>
      </div>
      <div className="pq-meta">
        <CodeLangPill language={q.code!.language} />
        <span className="small muted">{q.marks} mark{q.marks > 1 ? "s" : ""} · {subjects[sid] ?? sid}{topicById[q.topic] ? `: ${topicById[q.topic].name}` : ""}{rec?.correct ? " · ✓ Solved" : ""}</span>
      </div>
      <QuestionCard
        key={q.id}
        q={q}
        onResult={(ok) => {
          setPractice((p) => ({ ...p, [q.id]: { correct: ok, at: Date.now(), topic: q.topic } }));
          setFixed((f) => ({ ...f, [q.id]: ok }));
        }}
      />
      <div className="pq-nav">
        {prev ? <Link className="btn soft" href={`/practice/programming/${encodeURIComponent(prev.id)}`}>← Previous</Link> : <span />}
        {next ? <Link className="btn soft" href={`/practice/programming/${encodeURIComponent(next.id)}`}>Next →</Link> : <span />}
      </div>
    </div>
  );
}
