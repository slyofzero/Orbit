"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isDayLocked, LOCK_HOUR, LOCK_MESSAGE, useLockClock } from "@/lib/lock";
import { todayIST } from "@/lib/plan";

/** A padlock next to "Today": open before 9 AM, closed after. Hovering (or focusing) it explains the edit-lock rule. Renders nothing for other days. */
export default function DayLock({ date }: { date: string }) {
  const now = useLockClock();
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  if (date !== todayIST()) return null;
  const locked = isDayLocked(date, now);
  const show = () => { const r = btn.current?.getBoundingClientRect(); if (r) setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - 320)), y: r.bottom + 8 }); };
  return (
    <>
      <button ref={btn} type="button" className={`dl ${locked ? "is-locked" : ""}`} aria-label={locked ? "Today is locked" : "Today is still editable"}
        onMouseEnter={show} onMouseLeave={() => setPos(null)} onFocus={show} onBlur={() => setPos(null)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="11" width="16" height="10" rx="2.5" />
          {locked ? <path d="M8 11V8a4 4 0 0 1 8 0v3" /> : <path d="M8 11V8a4 4 0 0 1 7.5-2" />}
        </svg>
      </button>
      {pos && typeof document !== "undefined" && createPortal(
        <div className="dl-pop" role="tooltip" style={{ left: pos.x, top: pos.y }}>
          <b>{locked ? "Today is locked" : `Today is open until ${LOCK_HOUR} AM`}</b>
          <p>{locked ? LOCK_MESSAGE : `After ${LOCK_HOUR} AM today's tasks and linked questions (including carried-over bonus work) can't be edited or unlinked. You can still tick tasks and solve questions. Tomorrow and later days stay editable.`}</p>
        </div>, document.body)}
    </>
  );
}
