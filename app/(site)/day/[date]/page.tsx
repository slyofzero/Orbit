"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CalculatorButton from "@/components/CalculatorButton";
import QuestionCard from "@/components/QuestionCard";
import { liveQuestionIds, Links } from "@/lib/links";
import { attemptFrom, buildFixedMock } from "@/lib/mock";
import { fmtLong } from "@/lib/plan";
import { KEYS, usePack, usePersisted, usePlan } from "@/lib/store";
import { Attempt, PracticeRec } from "@/lib/types";
import Rich from "@/components/Rich";
import PageLoading from "@/components/PageLoading";
import SolvedAllModal from "@/components/SolvedAllModal";

// The exact questions the AI matched to one plan day.
export default function DayPractice() {
  const { date } = useParams<{ date: string }>();
  const router = useRouter();
  const { plan, ready: planReady } = usePlan();
  const { pack, byId, ready: packReady } = usePack();
  const [links, , lReady] = usePersisted<Links>(KEYS.links, {});
  const [practice, setPractice, pReady] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [, setFixed] = usePersisted<Record<string, boolean>>(KEYS.fixed, {});
  const [, setAttempts] = usePersisted<Attempt[]>(KEYS.attempts, []);
  const allReady = planReady && packReady && lReady && pReady;
  const link = links[date];
  const { ids, missing } = liveQuestionIds(link, pack);

  // Where you left off: questions you had already answered when you opened this day are tucked away (a snapshot, so a question you answer now stays on screen).
  const [seen, setSeen] = useState<{ date: string; done: Set<string> } | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [askDone, setAskDone] = useState(false); // every linked question already answered: ask before showing them
  useEffect(() => {
    if (allReady && seen?.date !== date) {
      const done = new Set(ids.filter((id) => practice[id]));
      setSeen({ date, done }); setShowDone(false);
      setAskDone(ids.length > 0 && done.size === ids.length);
    }
  }, [allReady, date, seen, ids, practice]);

  if (!allReady) return <PageLoading />;

  const day = plan.days.find((d) => d.date === date);
  const qs = ids.map((id) => byId.get(id)!).filter(Boolean);
  const got = ids.filter((id) => practice[id]);
  const right = ids.filter((id) => practice[id]?.correct).length;
  const mock = link?.mock ? pack.mockTests.find((m) => m.id === link.mock) : undefined;

  const old = seen && seen.date === date ? seen.done : null;
  const nDone = old ? ids.filter((id) => old.has(id)).length : 0;
  const shown = qs.map((q, i) => ({ q, n: i + 1 })).filter(({ q }) => !(old && !showDone && old.has(q.id)));

  const startMock = () => {
    if (!mock) return;
    const a = attemptFrom(buildFixedMock(mock));
    setAttempts((p) => [a, ...p]);
    router.push(`/exam/${a.id}`);
  };

  return (
    <>
      {askDone && (
        <SolvedAllModal
          name={day ? day.title : date}
          count={ids.length}
          onView={() => { setAskDone(false); setShowDone(true); }}
          onReset={() => { setPractice((p) => Object.fromEntries(Object.entries(p).filter(([id]) => !ids.includes(id)))); setSeen({ date, done: new Set() }); setShowDone(false); setAskDone(false); }}
        />
      )}
      <CalculatorButton />
      <p className="small"><Link href="/planner">← Planner</Link></p>
      <div className="row">
        <h1>{day ? <Rich text={day.title} /> : date}</h1>
        {nDone > 0 && !askDone && (
          <button
            key={`eye-${date}`}
            className={`tp-eye right ${showDone ? "on" : ""}`}
            onClick={() => setShowDone((v) => !v)}
            aria-pressed={showDone}
            aria-label={showDone ? "Showing all questions. Hide the ones you already answered" : `${nDone} question${nDone === 1 ? "" : "s"} you already answered ${nDone === 1 ? "is" : "are"} hidden. Show all`}
            data-tip={showDone ? "Showing every question. Click to hide the ones you already answered." : `${nDone} question${nDone === 1 ? "" : "s"} you already answered ${nDone === 1 ? "is" : "are"} hidden. Click to view all.`}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
              {!showDone && <path d="M4 20L20 4" />}
            </svg>
          </button>
        )}
      </div>
      <p className="muted">{fmtLong(date)}{link?.note ? <>. <Rich text={link.note} /></> : ""}</p>
      {!link && <div className="card muted">No questions are linked to this day. Open Planner, then Link with AI.</div>}
      {mock && <div className="card row"><span>Mock test: <b>{mock.name}</b> ({mock.minutes} minutes)</span><button className="btn primary right" onClick={startMock}>Start the mock</button></div>}
      {qs.length > 0 && <p className="muted">{got.length} of {qs.length} answered, {right} correct.</p>}
      {missing > 0 && <p className="small" style={{ color: "var(--bad, #c0392b)" }}>🔴 {missing} linked question{missing === 1 ? " is" : "s are"} no longer in your pack and {missing === 1 ? "is" : "are"} hidden.</p>}
      {old && !askDone && shown.map(({ q, n }) => (
        <QuestionCard
          key={q.id}
          q={q}
          index={n}
          showTopic
          onResult={(ok) => {
            setPractice((p) => ({ ...p, [q.id]: { correct: ok, at: Date.now(), topic: q.topic } }));
            setFixed((f) => ({ ...f, [q.id]: ok }));
          }}
        />
      ))}
    </>
  );
}
