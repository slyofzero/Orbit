"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BANK } from "@/lib/bank";
import { GENERATORS } from "@/lib/generators";
import { buildMock, MockOptions } from "@/lib/mock";
import { marksFor } from "@/lib/scoring";
import { KEYS, usePersisted } from "@/lib/store";
import { Attempt, PracticeRec } from "@/lib/types";
import { SUBJECTS, TOPICS } from "@/lib/topics";

export default function Mocks() {
  const router = useRouter();
  const [attempts, setAttempts, ready] = usePersisted<Attempt[]>(KEYS.attempts, []);
  const [practice] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [subject, setSubject] = useState("ml");
  const [msg, setMsg] = useState("");

  const start = (kind: MockOptions["kind"]) => {
    const seen = new Set<string>([...attempts.flatMap((a) => a.questions.map((q) => q.id)), ...Object.keys(practice)]);
    const weakTopics = TOPICS.filter((t) => t.status !== "know").map((t) => t.id);
    const m = buildMock({ kind, subject, seed: Date.now() % 2147483647, seenIds: seen, weakTopics });
    if (m.questions.length === 0) {
      setMsg("Could not build a mock: no questions available for that choice.");
      return;
    }
    const id = `m${Date.now().toString(36)}`;
    const a: Attempt = {
      id, title: m.title, createdAt: Date.now(), durationSec: m.durationSec,
      questions: m.questions, sections: m.sections, responses: {}, warnings: m.warnings,
    };
    setAttempts((p) => [a, ...p]);
    router.push(`/exam/${id}`);
  };

  if (!ready) return <p className="muted">Loading…</p>;
  const scoreOf = (a: Attempt) => a.questions.reduce((s, q, i) => s + marksFor(q, a.responses[i]?.ans), 0);

  return (
    <>
      <h1>Mocks</h1>
      <p className="muted">
        The arena copies the layout of the real GATE exam screen: question palette, Save &amp; Next, Mark for Review, virtual calculator, NAT keypad, section tabs and the 3-hour timer.
        Marking follows GATE: MCQ has negative marking (1/3 for 1 mark, 2/3 for 2 marks), MSQ and NAT have none.
      </p>
      <div className="callout warn">
        🔴 CAUTION: Do NOT leave the page, refresh to "reset", or open the solutions during a mock. The timer runs from the wall clock and keeps going. Treat it like the real exam.
      </div>

      <div className="mock-grid">
        <div className="mock-card big">
          <span className="num">3 hours</span>
          <h2 style={{ margin: 0 }}>Full mock</h2>
          <p className="small muted">65 questions and 100 marks: 10 General Aptitude and 55 Data Science and AI, the same split as the real paper.</p>
          <div><button className="btn" onClick={() => start("full")}>Start full mock</button></div>
        </div>
        <div className="mock-card">
          <h2>1-hour sectional</h2>
          <p className="small muted">About a third of the paper (~21 questions, ~33 marks). Use this in degree-exam weeks.</p>
          <button className="btn primary" onClick={() => start("sectional")}>Start sectional</button>
        </div>
        <div className="mock-card">
          <h2>Subject test</h2>
          <p className="small muted">Up to 12 one-mark and 8 two-mark questions from one subject.</p>
          <div className="row">
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {Object.entries(SUBJECTS).filter(([k]) => k !== "ga").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn primary" onClick={() => start("subject")}>Start</button>
          </div>
        </div>
        <div className="mock-card">
          <h2>Weak-topics test</h2>
          <p className="small muted">Only your "no idea" and "shaky" topics ({TOPICS.filter((t) => t.status !== "know").length} topics).</p>
          <button className="btn primary" onClick={() => start("weak")}>Start weak-topics test</button>
        </div>
      </div>
      {msg && <div className="callout">{msg}</div>}

      <div className="small muted" style={{ margin: "6px 0 18px" }}>
        Question supply: {BANK.length} hand-written questions + {GENERATORS.length} random generators. Unseen questions are preferred; numeric generators make every mock different.
      </div>

      <div className="card">
        <h2>History</h2>
        {attempts.length === 0 ? (
          <p className="muted">No attempts yet.</p>
        ) : (
          <table className="t">
            <thead><tr><th>Test</th><th>Date</th><th>Qs</th><th>Status</th><th>Score</th><th /></tr></thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td className="muted">{new Date(a.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{a.questions.length}</td>
                  <td>{a.submittedAt ? "Submitted" : a.startedAt ? "In progress" : "Not started"}</td>
                  <td>{a.submittedAt ? `${scoreOf(a).toFixed(2)} / ${a.questions.reduce((s, q) => s + q.marks, 0)}` : "—"}</td>
                  <td>
                    {a.submittedAt ? <Link href={`/results/${a.id}`}>Review</Link> : <Link href={`/exam/${a.id}`}>{a.startedAt ? "Resume" : "Start"}</Link>}
                    {" · "}
                    <a href="#" onClick={(e) => { e.preventDefault(); if (confirm("Delete this attempt?")) setAttempts((p) => p.filter((x) => x.id !== a.id)); }}>delete</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
