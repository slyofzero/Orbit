"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { QUOTES } from "@/lib/quotes";
import { KEYS, usePersisted } from "@/lib/store";

type QState = { seen: number[]; last: number; cur?: number };
const ROTATE_MS = 30 * 60 * 1000; // a new quote every half hour, or when you ask for one

// A permanent banner. A quote is never shown twice until all of them have been.
export default function QuoteCard() {
  const [state, setState, ready] = usePersisted<QState>(KEYS.quotes, { seen: [], last: 0 });
  const [spin, setSpin] = useState(0);
  const ref = useRef(state);
  ref.current = state;

  const next = useCallback(() => {
    const { seen } = ref.current;
    let pool = QUOTES.map((_, i) => i).filter((i) => !seen.includes(i));
    let used = seen;
    if (pool.length === 0) { pool = QUOTES.map((_, i) => i); used = []; }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setState({ seen: [...used, pick], last: Date.now(), cur: pick });
  }, [setState]);

  useEffect(() => {
    if (!ready) return;
    const s = ref.current;
    if (s.cur === undefined || Date.now() - s.last > ROTATE_MS) next();
    const t = setInterval(() => {
      if (!document.hidden && Date.now() - ref.current.last > ROTATE_MS) next();
    }, 60_000);
    return () => clearInterval(t);
  }, [ready, next]);

  const text = state.cur !== undefined ? QUOTES[state.cur] : "";
  return (
    <aside className="quote-banner" aria-label="A thought for today">
      <svg className="q-mark" viewBox="0 0 48 36" aria-hidden="true"><path d="M0 36V20C0 8 6 1 18 0v7c-6 1-9 5-9 11h9v18H0zm28 0V20C28 8 34 1 46 0v7c-6 1-9 5-9 11h9v18H28z" /></svg>
      <p key={state.cur}>{text}</p>
      <button onClick={() => { setSpin((n) => n + 1); next(); }} aria-label="Show another quote" title="Another">
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${spin * 180}deg)` }}><path d="M20 12a8 8 0 01-14 5.3M4 12a8 8 0 0114-5.3M18 3v4h-4M6 21v-4h4" /></svg>
      </button>
    </aside>
  );
}
