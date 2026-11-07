"use client";
import { useEffect, useMemo, useState } from "react";
import QuestionCard from "@/components/QuestionCard";
import { findQuestion } from "@/lib/bank";
import { isAttempted, isCorrect } from "@/lib/scoring";
import { KEYS, usePack, usePersisted } from "@/lib/store";
import { Attempt, PracticeRec, Question } from "@/lib/types";

interface Mistake { q: Question; source: string }

export default function MistakesPanel() {
  const { pack, byId, topicById: TOPIC_BY_ID, subjects: SUBJECTS, ready: r3 } = usePack();
  const [practice, setPractice, r1] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [attempts, , r2] = usePersisted<Attempt[]>(KEYS.attempts, []);
  const [fixed, setFixed] = usePersisted<Record<string, boolean>>(KEYS.fixed, {});
  const [subject, setSubject] = useState("all");
  const [snapshot, setSnapshot] = useState<Mistake[] | null>(null);

  const mistakes = useMemo(() => {
    const m = new Map<string, Mistake>();
    for (const [id, rec] of Object.entries(practice)) {
      if (rec.correct) continue;
      const q = findQuestion(pack, byId, id);
      if (q) m.set(id, { q, source: "Practice" });
    }
    for (const a of attempts.filter((x) => x.submittedAt && !x.failed)) {
      a.questions.forEach((q, i) => {
        const ans = a.responses[i]?.ans;
        if (isAttempted(ans) && !isCorrect(q, ans)) m.set(q.id, { q, source: a.title + " (wrong)" });
        else if (!isAttempted(ans) && !m.has(q.id)) m.set(q.id, { q, source: a.title + " (unattempted)" });
      });
    }
    return [...m.values()].filter((x) => !fixed[x.q.id]);
  }, [practice, attempts, fixed, pack, byId]);

  // freeze the list on load so a card does not vanish the moment you solve it
  useEffect(() => {
    if (r1 && r2 && r3 && snapshot === null) setSnapshot(mistakes);
  }, [r1, r2, r3, snapshot, mistakes]);

  if (!r1 || !r2 || !r3 || snapshot === null) return <p className="muted">Loading…</p>;
  const list = snapshot;
  const shown = list.filter((x) => subject === "all" || TOPIC_BY_ID[x.q.topic]?.subject === subject);

  return (
    <>
      <p className="muted">
        Every question you got wrong or skipped, in practice or in mocks, lands here automatically. Solve it correctly once to clear it.
      </p>
      <div className="callout warn">🔴 CAUTION: Do NOT skip this page. Review it after every mock; it is the highest-value 30 minutes of your week.</div>
      <div className="tabs">
        <button className={subject === "all" ? "on" : ""} onClick={() => setSubject("all")}>All ({list.length})</button>
        {Object.entries(SUBJECTS).map(([k, v]) => {
          const n = list.filter((x) => TOPIC_BY_ID[x.q.topic]?.subject === k).length;
          return n ? <button key={k} className={subject === k ? "on" : ""} onClick={() => setSubject(k)}>{v} ({n})</button> : null;
        })}
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="small muted">{mistakes.length} still to fix</span>
        <button className="btn" onClick={() => setSnapshot(mistakes)}>Refresh list</button>
      </div>
      {shown.length === 0 && <div className="card muted">Nothing to fix. Take a mock or practise a topic first.</div>}
      {shown.map((x, i) => (
        <div key={x.q.id}>
          <div className="small muted">From: {x.source} {fixed[x.q.id] && <span className="pill know">cleared ✓</span>}</div>
          <QuestionCard
            q={x.q}
            index={i + 1}
            showTopic
            onResult={(ok) => {
              setPractice((p) => ({ ...p, [x.q.id]: { correct: ok, at: Date.now(), topic: x.q.topic } }));
              setFixed((f) => ({ ...f, [x.q.id]: ok }));
            }}
          />
        </div>
      ))}
    </>
  );
}
