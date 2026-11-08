"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Answer, Question } from "@/lib/types";
import { formatAnswer, isAttempted, isCorrect, negLabel } from "@/lib/scoring";
import { logPractice, usePack } from "@/lib/store";
import { announce } from "@/lib/outcome";
import Rich from "./Rich";
import CodeQuestion from "./CodeQuestion";

const TYPE_LABEL = { mcq: "MCQ", msq: "MSQ", nat: "NAT", code: "CODE" } as const;

export default function QuestionCard({
  q, index, onResult, showTopic,
}: { q: Question; index?: number; onResult?: (correct: boolean) => void; showTopic?: boolean }) {
  const { topicById: TOPIC_BY_ID, subjects: SUBJECTS } = usePack();
  const subjectName = (x: Question) => { const id = x.subject ?? TOPIC_BY_ID[x.topic]?.subject ?? ""; return SUBJECTS[id] ?? id; };
  const [sel, setSel] = useState<Answer | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [tries, setTries] = useState(0);
  const ok = checked && isCorrect(q, sel);
  const shownAt = useRef(Date.now()); // when this question started waiting for an answer
  // every answer or skip is logged with its subject, topic and tags, so statistics can count each encounter
  const log = (out: "right" | "wrong" | "skip") =>
    logPractice({
      q: q.id, topic: q.topic, subject: q.subject ?? TOPIC_BY_ID[q.topic]?.subject ?? "other", tags: q.tags, type: q.type, marks: q.marks,
      out, at: Date.now(), ms: Math.min(Date.now() - shownAt.current, 600_000),
    });

  const toggle = (i: number) => {
    if (checked || skipped) return;
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

  const skip = () => { setSkipped(true); log("skip"); announce("skip"); };
  const reset = () => { setSel(undefined); setChecked(false); setSkipped(false); shownAt.current = Date.now(); };

  return (
    <div className="qcard">
      <div className="qmeta">
        {index !== undefined && <b>Q{index}.</b>}
        <span className="pill">{TYPE_LABEL[q.type]}</span>
        <span className="pill">{q.marks} mark{q.marks > 1 ? "s" : ""}</span>
        <span className="small muted">{q.type === "mcq" ? `Negative: −${negLabel(q)}` : "No negative marking"}</span>
        {showTopic && TOPIC_BY_ID[q.topic] && (
          <Link href={`/practice/${q.topic}`} className="small right">{TOPIC_BY_ID[q.topic].name}</Link>
        )}
      </div>
      <div className="qtext"><Rich text={q.text} /></div>
      {(TOPIC_BY_ID[q.topic] || q.tags?.length) && (
        <div className="qtags">
          {(q.subject ?? TOPIC_BY_ID[q.topic]?.subject) && <span className="tg subj">{subjectName(q)}</span>}
          {TOPIC_BY_ID[q.topic] && <span className="tg tp">{TOPIC_BY_ID[q.topic].name}</span>}
          {q.tags?.map((t) => <span key={t} className="tg">#{t}</span>)}
        </div>
      )}

      {q.type === "code" && (
        <CodeQuestion
          q={q} key={`${q.id}-${tries}`}
          onSubmit={(right) => { onResult?.(right); log(right ? "right" : "wrong"); announce(right ? "right" : "wrong"); }}
          onSkip={() => { log("skip"); announce("skip"); }}
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

      {q.type === "nat" && (
        <input
          className="natinput" type="text" inputMode="decimal" placeholder="Type your answer"
          value={(sel as string | undefined) ?? ""} disabled={checked}
          onChange={(e) => setSel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
        />
      )}

      {q.type !== "code" && <div className="row" style={{ marginTop: 10 }}>
        {!checked && !skipped ? (
          <>
            <button className="btn primary" onClick={check} disabled={!isAttempted(sel)}>Check answer</button>
            <button className="btn" onClick={skip}>Skip</button>
          </>
        ) : (
          <button className="btn" onClick={reset}>Try again</button>
        )}
      </div>}

      {skipped && (
        <div className="verdict no">
          <b>Skipped</b>
          <div>Correct answer: <b>{formatAnswer(q)}</b></div>
          <div style={{ marginTop: 6 }}><Rich text={q.explanation} /></div>
        </div>
      )}

      {checked && (
        <div className={`verdict ${ok ? "ok" : "no"}`}>
          <b>{ok ? "Correct ✓" : "Not quite ✗"}</b>
          {!ok && <div>Correct answer: <b>{formatAnswer(q)}</b></div>}
          <div style={{ marginTop: 6 }}><Rich text={q.explanation} /></div>
        </div>
      )}
    </div>
  );
}
