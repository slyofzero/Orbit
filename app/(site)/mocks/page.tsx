"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildFixedMock, buildMock, MockOptions } from "@/lib/mock";
import { FixedMock, MockTemplate } from "@/lib/packs";
import { marksFor } from "@/lib/scoring";
import { KEYS, usePack, usePersisted } from "@/lib/store";
import { Attempt, PracticeRec } from "@/lib/types";

const countQs = (t: MockTemplate) => t.sections.reduce((s, x) => s + x.picks.reduce((a, p) => a + p.one + p.two, 0), 0);
const countMarks = (t: MockTemplate) => t.sections.reduce((s, x) => s + x.picks.reduce((a, p) => a + p.one + 2 * p.two, 0), 0);

const fixedQs = (m: FixedMock) => m.sections.reduce((s, x) => s + x.questions.length, 0);
const fixedMarks = (m: FixedMock) => m.sections.reduce((s, x) => s + x.questions.reduce((a, q) => a + q.marks, 0), 0);

export default function Mocks() {
  const router = useRouter();
  const { pack, custom: hasPack, ready: packReady } = usePack();
  const [attempts, setAttempts, ready] = usePersisted<Attempt[]>(KEYS.attempts, []);
  const [practice] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const subjectIds = Object.keys(pack.subjects);
  const [subject, setSubject] = useState("");
  const chosen = subject && pack.subjects[subject] ? subject : subjectIds[0] ?? "";
  const [msg, setMsg] = useState("");

  const start = (opts: Omit<MockOptions, "seed" | "seenIds">, fixed?: FixedMock) => {
    const seen = new Set<string>([...attempts.flatMap((a) => a.questions.map((q) => q.id)), ...Object.keys(practice)]);
    const m = fixed ? buildFixedMock(fixed) : buildMock(pack, { ...opts, seed: Date.now() % 2147483647, seenIds: seen });
    if (m.questions.length === 0) {
      setMsg("Could not build a mock: your pack has no questions for that choice.");
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

  if (!ready || !packReady) return <p className="muted">Loading…</p>;
  const scoreOf = (a: Attempt) => a.questions.reduce((s, q, i) => s + marksFor(q, a.responses[i]?.ans), 0);
  const weakN = pack.topics.filter((t) => t.status !== "know").length;

  return (
    <>
      <h1>Mocks</h1>
      <p className="muted">
        The arena is an exam-style screen: question palette, Save &amp; Next, Mark for Review, virtual calculator, NAT keypad, section tabs and a countdown timer.
        Marking: MCQ has negative marking (1/3 of the marks), MSQ and NAT have none.
      </p>
      <div className="callout">🔴 CAUTION: Mocks run in FULL SCREEN. Switching tabs or windows, pressing Esc or refreshing ends the test and marks it FAILED.</div>

      {!hasPack ? (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>No mock tests yet</h2>
          <p className="muted">Mocks are built from your question pack and its mock recipes. Load a pack first and your tests will appear here.</p>
          <Link className="btn primary" href="/practice">Load a question pack</Link>
        </div>
      ) : (
        <>
          <div className="callout warn">
            🔴 CAUTION: Do NOT leave the page, refresh to "reset", or open the solutions during a mock. The timer runs from the wall clock and keeps going. Treat it like the real exam.
          </div>

          <div className="mock-grid">
            {pack.mockTests.map((t, i) => {
              const tries = attempts.filter((a) => a.title === t.name && a.submittedAt && !a.failed);
              const best = tries.length ? Math.max(...tries.map((a) => scoreOf(a))) : null;
              return (
                <div key={t.id} className={`mock-card ${i === 0 ? "big" : ""}`}>
                  {i === 0 && <span className="num">{t.minutes >= 60 && t.minutes % 60 === 0 ? `${t.minutes / 60} hour${t.minutes === 60 ? "" : "s"}` : `${t.minutes} min`}</span>}
                  <h2 style={i === 0 ? { margin: 0 } : undefined}>{t.name}</h2>
                  <p className="small muted">{fixedQs(t)} questions, {fixedMarks(t)} marks, {t.minutes} minutes. Its questions belong to this mock only.{t.note ? ` ${t.note}` : ""}{best !== null ? ` Best score ${best.toFixed(2)} (${tries.length} attempt${tries.length === 1 ? "" : "s"}).` : ""}</p>
                  <div><button className={i === 0 ? "btn" : "btn primary"} onClick={() => start({ kind: "template" }, t)}>{tries.length ? "Start again" : "Start"}</button></div>
                </div>
              );
            })}
            {pack.mocks.map((t, i) => (
              <div key={t.id} className={`mock-card ${i === 0 && !pack.mockTests.length ? "big" : ""}`}>
                {i === 0 && <span className="num">{t.minutes >= 60 && t.minutes % 60 === 0 ? `${t.minutes / 60} hour${t.minutes === 60 ? "" : "s"}` : `${t.minutes} min`}</span>}
                <h2 style={i === 0 ? { margin: 0 } : undefined}>{t.name}</h2>
                <p className="small muted">{countQs(t)} questions, {countMarks(t)} marks, {t.minutes} minutes.{t.note ? ` ${t.note}` : ""}</p>
                <div><button className={i === 0 ? "btn" : "btn primary"} onClick={() => start({ kind: "template", template: t })}>Start</button></div>
              </div>
            ))}
            {pack.mocks.length === 0 && pack.mockTests.length === 0 && (
              <div className="mock-card big">
                <span className="num">Quick</span>
                <h2 style={{ margin: 0 }}>Quick mixed test</h2>
                <p className="small muted">About 15 questions drawn from every subject in your pack.</p>
                <div><button className="btn" onClick={() => start({ kind: "quick" })}>Start quick test</button></div>
              </div>
            )}
            <div className="mock-card">
              <h2>Subject test</h2>
              <p className="small muted">Up to 12 one-mark and 8 two-mark questions from one subject.</p>
              <div className="row">
                <select value={chosen} onChange={(e) => setSubject(e.target.value)}>
                  {Object.entries(pack.subjects).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button className="btn primary" onClick={() => start({ kind: "subject", subject: chosen })}>Start</button>
              </div>
            </div>
            {weakN > 0 && (
              <div className="mock-card">
                <h2>Weak-topics test</h2>
                <p className="small muted">Only your "no idea" and "shaky" topics ({weakN} topic{weakN === 1 ? "" : "s"}).</p>
                <button className="btn primary" onClick={() => start({ kind: "weak" })}>Start weak-topics test</button>
              </div>
            )}
          </div>
          {msg && <div className="callout">{msg}</div>}

          <div className="small muted" style={{ margin: "6px 0 18px" }}>
            Practice questions: {pack.questions.length} in "{pack.name}"{pack.useBuiltinGenerators ? " plus numeric generators" : ""}. Unseen questions are preferred. {pack.mockTests.length > 0 && `Mock tests above use their own ${pack.mockTests.reduce((n, m) => n + fixedQs(m), 0)} questions, kept apart from Practice.`}
          </div>
        </>
      )}

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
                  <td>{a.failed ? "Failed" : a.submittedAt ? "Submitted" : a.startedAt ? "In progress" : "Not started"}</td>
                  <td>{a.failed ? "—" : a.submittedAt ? `${scoreOf(a).toFixed(2)} / ${a.questions.reduce((s, q) => s + q.marks, 0)}` : "—"}</td>
                  <td>
                    {a.submittedAt ? <Link href={`/results/${a.id}`}>Review</Link> : <Link href={`/exam/${a.id}`}>{a.startedAt ? "Open (ends as failed)" : "Start"}</Link>}
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
