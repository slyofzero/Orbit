"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import TagFilter from "@/components/TagFilter";
import { makeMatcher } from "@/lib/questionFilter";
import { announce } from "@/lib/outcome";
import CalculatorButton from "@/components/CalculatorButton";
import QuestionCard from "@/components/QuestionCard";
import PageLoading from "@/components/PageLoading";
import SolvedAllModal from "@/components/SolvedAllModal";
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
  const [views] = usePersisted<{ q: string; at: number }[]>(KEYS.views, []);

  const [picked, setPicked] = useState<string[]>([]);
  const passes = useMemo(() => makeMatcher(pack, picked), [pack, picked]);
  const questions: Question[] = useMemo(() => {
    if (!t) return [];
    const gen = (extra[topic] ?? []).map((s) => newGenerated(pack, topic, s)).filter(Boolean) as Question[];
    return [...staticForTopic(pack, topic).filter((x) => x.type !== "code"), ...gen]; // programming questions live in Practice, Programming
  }, [t, topic, extra, pack]);

  // Where you left off: the questions you had already answered when you opened this topic are tucked away,
  // so the list starts at the first one you have not answered. (A snapshot, so a question you answer now stays on screen.)
  const [seen, setSeen] = useState<{ topic: string; ids: Set<string> } | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [askDone, setAskDone] = useState(false); // every question already answered: ask before showing them
  useEffect(() => {
    if (ready && packReady && t && seen?.topic !== topic) {
      const ids = new Set(Object.keys(practice));
      setSeen({ topic, ids }); setShowDone(false);
      setAskDone(questions.length > 0 && questions.every((q) => ids.has(q.id)));
    }
  }, [ready, packReady, t, topic, practice, seen, questions]);

  // "Seen" = questions of this topic that were on screen at least once, plus any you answered.
  const seenCount = useMemo(() => {
    const ids = new Set(questions.map((q) => q.id));
    const got = new Set<string>();
    for (const v of views) if (ids.has(v.q)) got.add(v.q);
    for (const [id, r] of Object.entries(practice)) if (r.topic === topic) got.add(id);
    return got.size;
  }, [questions, views, practice, topic]);

  // Ten questions per page: the page stays light however many questions the topic has.
  const PAGE_SIZE = 10;
  const list = useMemo(() => questions.filter(passes), [questions, passes]);
  const old = seen && seen.topic === topic ? seen.ids : null;
  const visible = useMemo(() => list.map((q, i) => ({ q, n: i + 1 })).filter(({ q }) => !(old && !showDone && old.has(q.id))), [list, old, showDone]);
  const [page, setPage] = useState(1);
  const [painted, setPainted] = useState(false);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  useEffect(() => { setPage(1); setPainted(false); }, [topic]);
  useEffect(() => { setPage(1); }, [picked, showDone]);
  const go = (n: number) => { setPage(Math.min(pages, Math.max(1, n))); window.scrollTo({ top: 0, behavior: "smooth" }); };
  useEffect(() => {
    if (!ready || !packReady || !old || painted) return;
    let b = 0;
    const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setPainted(true)); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [ready, packReady, old, painted]);

  // Leaving gets a reaction: a kind one if you answered anything this visit (right or wrong), a nudge only if you answered nothing.
  const latest = useRef({ questions, practice, topic });
  latest.current = { questions, practice, topic };
  const openedAt = useRef(Date.now());
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // the short wait skips the fake unmount React does in development
      setTimeout(() => {
        if (alive.current) return;
        const { questions: qs, practice: pr, topic: tp } = latest.current;
        const answeredNow = Object.values(pr).filter((r) => r.topic === tp && r.at >= openedAt.current).length;
        if (answeredNow > 0) announce("progress");
        else if (qs.some((x) => !pr[x.id])) announce("quit");
      }, 60);
    };
  }, []);

  if (!packReady) return <><PageLoading /></>;
  if (!t) return <p>Unknown topic. <Link href="/practice">Back to topics</Link></p>;
  if (!ready) return <><PageLoading /></>;

  const pager = pages > 1 ? (
    <nav className="pl-nav" aria-label="Question pages">
      <button className="btn soft" disabled={cur === 1} onClick={() => go(cur - 1)}>‹ Prev</button>
      <span className="small">Page{" "}
        <select className="pe-in" style={{ padding: "4px 8px" }} value={cur} onChange={(e) => go(Number(e.target.value))} aria-label="Go to page">
          {Array.from({ length: pages }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
        </select>{" "}of {pages}
      </span>
      <button className="btn soft" disabled={cur === pages} onClick={() => go(cur + 1)}>Next ›</button>
    </nav>
  ) : null;
  const nDone = old ? list.filter((q) => old.has(q.id)).length : 0;
  const mine = Object.entries(practice).filter(([, r]) => r.topic === topic);
  const correct = mine.filter(([, r]) => r.correct).length;
  const wrong = mine.length - correct;
  const total = Math.max(1, questions.length);

  const addMore = (n: number) => {
    const seeds = Array.from({ length: n }, () => Math.floor(Math.random() * 1e9));
    setExtra((p) => ({ ...p, [topic]: [...(p[topic] ?? []), ...seeds] }));
  };

  return (
    <>
      <PageLoading active={!painted} />
      {askDone && (
        <SolvedAllModal
          name={t.name}
          count={questions.length}
          onView={() => { setAskDone(false); setShowDone(true); }}
          onReset={() => { setPractice((p) => Object.fromEntries(Object.entries(p).filter(([, r]) => r.topic !== topic))); setSeen({ topic, ids: new Set() }); setShowDone(false); setAskDone(false); setPage(1); }}
        />
      )}
      <CalculatorButton />
      <p className="small"><Link href="/practice">← All topics</Link></p>
      <div className="row">
        <h1>{t.name}</h1>
        <span className={`pill ${t.status}`}>{t.status === "noidea" ? "no idea" : t.status}</span>
        {nDone > 0 && !askDone && (
          <button
            key={`eye-${topic}`}
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

      {questions.length === 0 && <div className="card muted">No questions for this topic yet. Add some to your question pack and upload it again.</div>}

      <div className="pr-bar" style={{ justifyContent: "flex-end" }}>
        <div className="tp-stats" role="group" aria-label="Your progress in this topic">
          <span className="tp-chip seen"><b>{seenCount}</b> seen</span>
          <span className="tp-chip ok"><b>{correct}</b> correct</span>
          <span className="tp-chip bad"><b>{wrong}</b> wrong</span>
          <div className="tp-meter" title={`${seenCount} seen, ${correct} right, ${wrong} wrong, out of ${questions.length} questions`}>
            <div className="tp-track" aria-hidden="true">
              <i className="seen" style={{ width: `${Math.min(100, (seenCount / total) * 100)}%` }} />
              <i className="ok" style={{ width: `${Math.min(100, (correct / total) * 100)}%` }} />
              <i className="bad" style={{ left: `${Math.min(100, (correct / total) * 100)}%`, width: `${Math.min(100, (wrong / total) * 100)}%` }} />
            </div>
            <span className="small muted">{mine.length} of {questions.length} answered</span>
          </div>
        </div>
        <TagFilter pack={pack} groups={["difficulty", "tag"]} qs={questions} picked={picked} onChange={setPicked} />
      </div>
      {picked.length > 0 && questions.filter(passes).length === 0 && <div className="card muted">No question has those tags.</div>}

      {old && !askDone && visible.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE).map(({ q, n }) => (
        <QuestionCard
          key={q.id}
          q={q}
          index={n}
          onResult={(ok) => {
            setPractice((p) => ({ ...p, [q.id]: { correct: ok, at: Date.now(), topic } }));
            setFixed((f) => ({ ...f, [q.id]: ok }));
          }}
        />
      ))}
      {!askDone && pager}

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
