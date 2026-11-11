"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Answer, Question } from "@/lib/types";
import { formatAnswer, isAttempted, isCorrect, negLabel } from "@/lib/scoring";
import { logPractice, logView, usePack } from "@/lib/store";
import { announce } from "@/lib/outcome";
import Rich from "./Rich";
import { strHint } from "@/lib/strMatch";
import { difficultyOf } from "@/lib/questionFilter";
import CodeQuestion from "./CodeQuestion";
import CopyIcon from "./CopyIcon";
import EditQuestionDialog from "./EditQuestionDialog";
import { copyQuestion } from "@/lib/copyQuestion";

const TYPE_LABEL = { mcq: "MCQ", msq: "MSQ", nat: "NAT", str: "TEXT", code: "CODE" } as const;

export default function QuestionCard({
  q, index, onResult, showTopic,
}: { q: Question; index?: number; onResult?: (correct: boolean) => void; showTopic?: boolean }) {
  const { topicById: TOPIC_BY_ID, subjects: SUBJECTS, byId } = usePack();
  const inPack = byId.has(q.id);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const subjectName = (x: Question) => { const id = x.subject ?? TOPIC_BY_ID[x.topic]?.subject ?? ""; return SUBJECTS[id] ?? id; };
  const [sel, setSel] = useState<Answer | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  const [tries, setTries] = useState(0);
  const ok = checked && isCorrect(q, sel);
  const shownAt = useRef(Date.now()); // when this question started waiting for an answer
  const root = useRef<HTMLDivElement>(null);
  // A view is counted once the card has been at least half on screen for a second. Skips are never clicked: they are views minus answers.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined, counted = false;
    const count = () => { if (!counted) { counted = true; logView(q.id); } };
    if (typeof IntersectionObserver === "undefined") { count(); return; }
    const io = new IntersectionObserver(([e]) => {
      if (counted) return;
      if (e.isIntersecting) timer = setTimeout(count, 1000); else clearTimeout(timer);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, [q.id]);
  // every answer is logged with its subject, topic and tags, so statistics can count each encounter
  const log = (out: "right" | "wrong") =>
    logPractice({
      ...((q.type === "mcq" || q.type === "msq") && isAttempted(sel) ? { pick: sel as number | number[] } : {}),
      q: q.id, topic: q.topic, subject: q.subject ?? TOPIC_BY_ID[q.topic]?.subject ?? "other", tags: [...(difficultyOf(q) ? [difficultyOf(q)!] : []), ...(q.tags ?? [])], type: q.type, marks: q.marks,
      out, at: Date.now(), ms: Math.min(Date.now() - shownAt.current, 600_000),
    });

  const toggle = (i: number) => {
    if (checked) return;
    if (q.type === "mcq") setSel(i);
    else {
      const cur = (sel as number[] | undefined) ?? [];
      setSel(cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]);
    }
  };

  const check = () => {
    if (!isAttempted(sel)) return;
    setChecked(true);
    const right = isCorrect(q, sel);
    onResult?.(right);
    log(right ? "right" : "wrong");
    announce(right ? "right" : "wrong");
  };

  const reset = () => { setSel(undefined); setChecked(false); shownAt.current = Date.now(); };

  return (
    <div className="qcard" ref={root}>
      <div className="qmeta">
        {index !== undefined && <b>Q{index}.</b>}
        <span className="pill">{TYPE_LABEL[q.type]}</span>
        <span className="pill">{q.marks} mark{q.marks > 1 ? "s" : ""}</span>
        <code className="qid" title="Question ID">{q.id}</code>
        <span className="small muted">{q.type === "mcq" ? `Negative: −${negLabel(q)}` : "No negative marking"}</span>
        {showTopic && TOPIC_BY_ID[q.topic] && (
          <Link href={q.type === "code" ? "/practice/programming" : `/practice/${q.topic}`} className="small right">{TOPIC_BY_ID[q.topic].name}</Link>
        )}
        <span className={`q-tools ${showTopic && TOPIC_BY_ID[q.topic] ? "" : "right"}`}>
          <button type="button" className="q-edit" title="Copy this question (text, options and pictures)" aria-label="Copy this question" onClick={async () => { const ok = await copyQuestion(q); setCopied(ok); setTimeout(() => setCopied(false), 1600); }}>
            <CopyIcon done={copied} />
          </button>
          {inPack && (
            <button type="button" className="q-edit" title="Edit this question" aria-label="Edit this question" onClick={() => setEditing(true)}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M14 7l3 3" /></svg>
            </button>
          )}
        </span>
      </div>
      <div className="qtext"><Rich text={q.text} /></div>
      {(TOPIC_BY_ID[q.topic] || q.tags?.length || difficultyOf(q)) && (
        <div className="qtags">
          {(q.subject ?? TOPIC_BY_ID[q.topic]?.subject) && <span className="tg subj">{subjectName(q)}</span>}
          {TOPIC_BY_ID[q.topic] && <span className="tg tp">{TOPIC_BY_ID[q.topic].name}</span>}
          {difficultyOf(q) && <span className={`tg diff-${difficultyOf(q)}`}>{difficultyOf(q)}</span>}
          {q.tags?.filter((t) => t !== difficultyOf(q)).map((t) => <span key={t} className="tg">#{t}</span>)}
        </div>
      )}

      {q.type === "code" && (
        <CodeQuestion
          q={q} key={`${q.id}-${tries}`}
          onSubmit={(right) => { onResult?.(right); log(right ? "right" : "wrong"); announce(right ? "right" : "wrong"); }}
          onReset={() => { shownAt.current = Date.now(); setTries((n) => n + 1); }}
        />
      )}

      {(q.type === "mcq" || q.type === "msq") &&
        q.options!.map((o, i) => {
          const picked = q.type === "mcq" ? sel === i : ((sel as number[] | undefined) ?? []).includes(i);
          const isRight = q.type === "mcq" ? q.answer === i : (q.answer as number[]).includes(i);
          const cls = checked ? (isRight ? "right" : picked ? "wrong" : "") : picked ? "sel" : "";
          return (
            <div key={i} className={`opt ${cls}`} onClick={() => toggle(i)}>
              <input type={q.type === "mcq" ? "radio" : "checkbox"} checked={picked} readOnly />
              <span><b>{String.fromCharCode(65 + i)}.</b> <Rich text={o} /></span>
            </div>
          );
        })}

      {q.type === "str" && strHint(q) && <p className="small muted" style={{ margin: "8px 0 4px" }}>{strHint(q)}</p>}
      {(q.type === "nat" || q.type === "str") && (
        <input
          className="natinput" type="text" inputMode={q.type === "nat" ? "decimal" : "text"} placeholder="Type your answer" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          value={(sel as string | undefined) ?? ""} disabled={checked}
          onChange={(e) => setSel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
        />
      )}

      {q.type !== "code" && <div className="row" style={{ marginTop: 10 }}>
        {!checked ? (
          <button className="btn primary" onClick={check} disabled={!isAttempted(sel)}>Check answer</button>
        ) : (
          <button className="btn" onClick={reset}>Try again</button>
        )}
      </div>}

      {checked && (
        <div className={`verdict ${ok ? "ok" : "no"}`}>
          <b>{ok ? "Correct ✓" : "Not quite ✗"}</b>
          {!ok && <div>Correct answer: <b><Rich text={formatAnswer(q)} /></b></div>}
          <div style={{ marginTop: 6 }}><Rich text={q.explanation} /></div>
        </div>
      )}
      {editing && <EditQuestionDialog id={q.id} onClose={() => setEditing(false)} />}
    </div>
  );
}
