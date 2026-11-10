"use client";
import { useEffect } from "react";

// Shown instead of the questions when a topic is opened and every question in it is already answered.
export default function SolvedAllModal({ name, count, onReset, onView }: { name: string; count: number; onReset: () => void; onView: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onView(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onView]);
  return (
    <div className="xf-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onView(); }}>
      <div className="xf-modal" role="dialog" aria-modal="true" aria-labelledby="sa-title">
        <h2 id="sa-title">You have solved every question here</h2>
        <p>You have answered all {count.toLocaleString()} question{count === 1 ? "" : "s"} in <b>{name}</b>. What would you like to do?</p>
        <p className="small muted">🔴 CAUTION: Reset progress clears your answered questions in this assignment so you start again from Q1. Your statistics history is kept.</p>
        <div className="xf-actions">
          <button className="btn primary" autoFocus onClick={onView}>View the questions, keep my progress</button>
          <button className="btn soft" onClick={onReset}>Reset my progress and start again</button>
        </div>
      </div>
    </div>
  );
}
