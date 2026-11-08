"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { announce } from "@/lib/outcome";
import QuestionCard from "@/components/QuestionCard";
import { hasGenerator, newGenerated, staticForTopic } from "@/lib/bank";
import { KEYS, usePack, usePersisted } from "@/lib/store";
import { PracticeRec, Question } from "@/lib/types";

export default function TopicPractice() {
  const { topic } = useParams<{ topic: string }>();
  const { pack, topicById, ready: packReady } = usePack();
  const t = topicById[topic];
  const [practice, setPractice, ready] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [extra, setExtra] = usePersisted<Record<string, number[]>>(KEYS.extra, {});
  const [, setFixed] = usePersisted<Record<string, boolean>>(KEYS.fixed, {});

  const questions: Question[] = useMemo(() => {
    if (!t) return [];
    const gen = (extra[topic] ?? []).map((s) => newGenerated(pack, topic, s)).filter(Boolean) as Question[];
    return [...staticForTopic(pack, topic).filter((x) => x.type !== "code"), ...gen]; // programming questions live in Practice, Programming
  }, [t, topic, extra, pack]);

  // leaving with unsolved questions gets a reaction
  const latest = useRef({ questions, practice });
  latest.current = { questions, practice };
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // the short wait skips the fake unmount React does in development
      setTimeout(() => {
        if (alive.current) return;
        const { questions: qs, practice: pr } = latest.current;
        if (qs.some((x) => !pr[x.id])) announce("quit");
      }, 60);
    };
  }, []);

  if (!packReady) return <p className="muted">Loading…</p>;
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

      {questions.length === 0 && <div className="card muted">No questions for this topic yet. Add some to your question pack and upload it again.</div>}

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

      {hasGenerator(pack, topic) && (
        <div className="row">
          <button className="btn primary" onClick={() => addMore(3)}>+ 3 fresh random questions</button>
          <button className="btn" onClick={() => addMore(1)}>+ 1</button>
          <span className="small muted">Numbers change each time; answers are computed by code.</span>
        </div>
      )}
    </>
  );
}
