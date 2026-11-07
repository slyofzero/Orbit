"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import QuestionCard from "@/components/QuestionCard";
import { TOPIC_BY_ID } from "@/lib/topics";
import { hasGenerator, newGenerated, staticForTopic } from "@/lib/bank";
import { KEYS, usePersisted } from "@/lib/store";
import { PracticeRec, Question } from "@/lib/types";

export default function TopicPractice() {
  const { topic } = useParams<{ topic: string }>();
  const t = TOPIC_BY_ID[topic];
  const [practice, setPractice, ready] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [extra, setExtra] = usePersisted<Record<string, number[]>>(KEYS.extra, {});
  const [, setFixed] = usePersisted<Record<string, boolean>>(KEYS.fixed, {});

  const questions: Question[] = useMemo(() => {
    if (!t) return [];
    const gen = (extra[topic] ?? []).map((s) => newGenerated(topic, s)).filter(Boolean) as Question[];
    return [...staticForTopic(topic), ...gen];
  }, [t, topic, extra]);

  if (!t) return <p>Unknown topic. <Link href="/practice">Back to topics</Link></p>;
  if (!ready) return <p className="muted">Loading…</p>;

  const mine = Object.entries(practice).filter(([, r]) => r.topic === topic);
  const correct = mine.filter(([, r]) => r.correct).length;

  const addMore = (n: number) => {
    const seeds = Array.from({ length: n }, () => Math.floor(Math.random() * 1e9));
    setExtra((p) => ({ ...p, [topic]: [...(p[topic] ?? []), ...seeds] }));
  };

  return (
    <>
      <p className="small"><Link href="/practice">← All topics</Link></p>
      <div className="row">
        <h1>{t.name}</h1>
        <span className={`pill ${t.status}`}>{t.status === "noidea" ? "no idea" : t.status}</span>
      </div>
      <p className="muted">{mine.length ? `${correct} correct out of ${mine.length} answered so far.` : "Not started yet."}</p>

      {questions.length === 0 && <div className="card muted">No questions for this topic yet. Ask Claude to add some to <code>lib/questions</code>.</div>}

      {questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          q={q}
          index={i + 1}
          onResult={(ok) => {
            setPractice((p) => ({ ...p, [q.id]: { correct: ok, at: Date.now(), topic } }));
            setFixed((f) => ({ ...f, [q.id]: ok }));
          }}
        />
      ))}

      {hasGenerator(topic) && (
        <div className="row">
          <button className="btn primary" onClick={() => addMore(3)}>+ 3 fresh random questions</button>
          <button className="btn" onClick={() => addMore(1)}>+ 1</button>
          <span className="small muted">Numbers change each time; answers are computed by code.</span>
        </div>
      )}
    </>
  );
}
