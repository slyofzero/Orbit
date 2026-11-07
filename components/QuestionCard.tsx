"use client";
import { useState } from "react";
import Link from "next/link";
import { Answer, Question } from "@/lib/types";
import { formatAnswer, isAttempted, isCorrect, negLabel } from "@/lib/scoring";
import { TOPIC_BY_ID } from "@/lib/topics";
import Rich from "./Rich";

const TYPE_LABEL = { mcq: "MCQ", msq: "MSQ", nat: "NAT" } as const;

export default function QuestionCard({
  q, index, onResult, showTopic,
}: { q: Question; index?: number; onResult?: (correct: boolean) => void; showTopic?: boolean }) {
  const [sel, setSel] = useState<Answer | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  const ok = checked && isCorrect(q, sel);

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
    onResult?.(isCorrect(q, sel));
  };

  const reset = () => { setSel(undefined); setChecked(false); };

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

      {q.type !== "nat" &&
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

      <div className="row" style={{ marginTop: 10 }}>
        {!checked ? (
          <button className="btn primary" onClick={check} disabled={!isAttempted(sel)}>Check answer</button>
        ) : (
          <button className="btn" onClick={reset}>Try again</button>
        )}
      </div>

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
