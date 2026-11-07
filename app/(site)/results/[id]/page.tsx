"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import Rich from "@/components/Rich";
import { formatAnswer, formatGiven, isAttempted, isCorrect, marksFor } from "@/lib/scoring";
import { KEYS, usePack, usePersisted } from "@/lib/store";
import { Attempt } from "@/lib/types";

type Filter = "all" | "wrong" | "skipped" | "right";

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const [attempts, , ready] = usePersisted<Attempt[]>(KEYS.attempts, []);
  const { topicById: TOPIC_BY_ID, subjects: SUBJECTS } = usePack();
  const [filter, setFilter] = useState<Filter>("all");
  const a = attempts.find((x) => x.id === id);

  if (!ready) return <p className="muted">Loading…</p>;
  if (!a) return <p>Attempt not found. <Link href="/mocks">Back to mocks</Link></p>;
  if (!a.submittedAt) return <p>This attempt is not submitted yet. <Link href={`/exam/${a.id}`}>Resume it</Link></p>;

  const rows = a.questions.map((q, i) => {
    const ans = a.responses[i]?.ans;
    const attempted = isAttempted(ans);
    const correct = attempted && isCorrect(q, ans);
    return { q, i, ans, attempted, correct, marks: marksFor(q, ans) };
  });
  const score = rows.reduce((s, r) => s + r.marks, 0);
  const max = rows.reduce((s, r) => s + r.q.marks, 0);
  const nCorrect = rows.filter((r) => r.correct).length;
  const nWrong = rows.filter((r) => r.attempted && !r.correct).length;
  const nSkip = rows.filter((r) => !r.attempted).length;
  const negLost = rows.filter((r) => r.marks < 0).reduce((s, r) => s + r.marks, 0);
  const takenMin = Math.round(((a.submittedAt - (a.startedAt ?? a.createdAt)) / 60000) * 10) / 10;

  const bySubject: Record<string, { n: number; c: number; w: number; s: number; marks: number; max: number }> = {};
  for (const r of rows) {
    const s = TOPIC_BY_ID[r.q.topic]?.subject ?? "other";
    const b = (bySubject[s] ??= { n: 0, c: 0, w: 0, s: 0, marks: 0, max: 0 });
    b.n++; b.max += r.q.marks; b.marks += r.marks;
    if (r.correct) b.c++; else if (r.attempted) b.w++; else b.s++;
  }

  const shown = rows.filter((r) => filter === "all" || (filter === "wrong" && r.attempted && !r.correct) || (filter === "skipped" && !r.attempted) || (filter === "right" && r.correct));

  return (
    <>
      <p className="small"><Link href="/mocks">← Mock tests</Link></p>
      <h1>{a.title}</h1>
      {a.failed && (
        <div className="callout warn">
          🔴 <b>FAILED. This test was ended and not scored.</b> {a.failed} Full-screen mode is required for the whole test. The answer key is below for review only.
        </div>
      )}
      <div className="scoreband">
        <div><div className="stat">{score.toFixed(2)}<span className="muted" style={{ fontSize: "1.1rem" }}> / {max}</span></div><div className="stat-label">Score</div></div>
        <div><div className="stat" style={{ color: "var(--green)" }}>{nCorrect}</div><div className="stat-label">Correct</div></div>
        <div><div className="stat" style={{ color: "var(--red)" }}>{nWrong}</div><div className="stat-label">Wrong, {Math.abs(negLost).toFixed(2)} marks lost</div></div>
        <div><div className="stat">{nSkip}</div><div className="stat-label">Skipped. Took {takenMin} of {Math.round(a.durationSec / 60)} min</div></div>
      </div>

      <div className="card">
        <h2>By subject</h2>
        <table className="t">
          <thead><tr><th>Subject</th><th>Questions</th><th>Correct</th><th>Wrong</th><th>Skipped</th><th>Marks</th></tr></thead>
          <tbody>
            {Object.entries(bySubject).map(([s, b]) => (
              <tr key={s}>
                <td>{SUBJECTS[s] ?? "Other"}</td><td>{b.n}</td><td>{b.c}</td><td>{b.w}</td><td>{b.s}</td>
                <td><b>{b.marks.toFixed(2)}</b> / {b.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="small muted" style={{ marginTop: 8 }}>Every wrong or skipped question has been added to your <Link href="/stats?tab=mistakes">Mistakes list</Link> automatically.</div>
      </div>

      <h2>Question review</h2>
      <div className="tabs">
        {([["all", "All"], ["wrong", "Wrong"], ["skipped", "Skipped"], ["right", "Correct"]] as [Filter, string][]).map(([k, l]) => (
          <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {shown.map((r) => (
        <div key={r.i} className="qcard">
          <div className="qmeta">
            <b>Q{r.i + 1}.</b>
            <span className="pill">{r.q.type.toUpperCase()}</span>
            <span className="pill">{r.q.marks} mark{r.q.marks > 1 ? "s" : ""}</span>
            <span className={`pill ${r.correct ? "know" : r.attempted ? "noidea" : ""}`}>
              {r.correct ? `+${r.q.marks}` : r.attempted ? (r.marks < 0 ? r.marks.toFixed(2) : "0") : "skipped"}
            </span>
            {TOPIC_BY_ID[r.q.topic] && <Link className="small right" href={`/practice/${r.q.topic}`}>{TOPIC_BY_ID[r.q.topic].name}</Link>}
          </div>
          <div className="qtext"><Rich text={r.q.text} /></div>
          <div className="qtags">
            <span className="tg subj">{SUBJECTS[TOPIC_BY_ID[r.q.topic]?.subject ?? ""] ?? "Other"}</span>
            {TOPIC_BY_ID[r.q.topic] && <span className="tg tp">{TOPIC_BY_ID[r.q.topic].name}</span>}
            {r.q.tags?.map((t) => <span key={t} className="tg">#{t}</span>)}
          </div>
          {r.q.options && (
            <div className="small" style={{ marginBottom: 6 }}>
              {r.q.options.map((o, k) => <div key={k}>({String.fromCharCode(65 + k)}) <Rich text={o} /></div>)}
            </div>
          )}
          <div className={`verdict ${r.correct ? "ok" : "no"}`}>
            <div>Your answer: <b>{formatGiven(r.q, r.ans)}</b> · Correct answer: <b>{formatAnswer(r.q)}</b></div>
            <div style={{ marginTop: 6 }}><Rich text={r.q.explanation} /></div>
          </div>
        </div>
      ))}
    </>
  );
}
