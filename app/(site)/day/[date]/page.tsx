"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import QuestionCard from "@/components/QuestionCard";
import { liveQuestionIds, Links } from "@/lib/links";
import { attemptFrom, buildFixedMock } from "@/lib/mock";
import { fmtLong } from "@/lib/plan";
import { KEYS, usePack, usePersisted, usePlan } from "@/lib/store";
import { Attempt, PracticeRec } from "@/lib/types";

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
  if (!planReady || !packReady || !lReady || !pReady) return <p className="muted">Loading…</p>;

  const day = plan.days.find((d) => d.date === date);
  const link = links[date];
  const { ids, missing } = liveQuestionIds(link, pack);
  const qs = ids.map((id) => byId.get(id)!).filter(Boolean);
  const got = ids.filter((id) => practice[id]);
  const right = ids.filter((id) => practice[id]?.correct).length;
  const mock = link?.mock ? pack.mockTests.find((m) => m.id === link.mock) : undefined;

  const startMock = () => {
    if (!mock) return;
    const a = attemptFrom(buildFixedMock(mock));
    setAttempts((p) => [a, ...p]);
    router.push(`/exam/${a.id}`);
  };

  return (
    <>
      <p className="small"><Link href="/planner">← Planner</Link></p>
      <h1>{day?.title ?? date}</h1>
      <p className="muted">{fmtLong(date)}{link?.note ? `. ${link.note}` : ""}</p>
      {!link && <div className="card muted">No questions are linked to this day. Open Planner, then Link with AI.</div>}
      {mock && <div className="card row"><span>Mock test: <b>{mock.name}</b> ({mock.minutes} minutes)</span><button className="btn primary right" onClick={startMock}>Start the mock</button></div>}
      {qs.length > 0 && <p className="muted">{got.length} of {qs.length} answered, {right} correct.</p>}
      {missing > 0 && <p className="small" style={{ color: "var(--bad, #c0392b)" }}>🔴 {missing} linked question{missing === 1 ? " is" : "s are"} no longer in your pack and {missing === 1 ? "is" : "are"} hidden.</p>}
      {qs.map((q, i) => (
        <QuestionCard
          key={q.id}
          q={q}
          index={i + 1}
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
