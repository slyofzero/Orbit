"use client";
import { useMemo, useState } from "react";
import { MONTH_NAMES, Milestone, addDays, weekday } from "@/lib/plan";
import { Day } from "@/lib/types";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Calendar({
  today, selected, onSelect, milestones, isComplete, days,
}: {
  days: Day[]; today: string; selected: string; onSelect: (d: string) => void; milestones: Milestone[]; isComplete: (date: string) => boolean;
}) {
  const BY_DATE = useMemo(() => new Map<string, Day>(days.map((d) => [d.date, d])), [days]);
  const [month, setMonth] = useState(selected.slice(0, 7)); // YYYY-MM
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const offset = (weekday(first) + 6) % 7; // Monday first
  const cells = 42; // always six weeks, so the calendar never changes height
  const msByDate = new Map(milestones.map((x) => [x.date, x]));

  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  return (
    <div>
      <div className="cal-head">
        <h2>{MONTH_NAMES[m - 1]} {y}</h2>
        <button className="iconbtn" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
        <button className="btn soft" onClick={() => { setMonth(today.slice(0, 7)); onSelect(today); }}>Today</button>
        <button className="iconbtn" onClick={() => shift(1)} aria-label="Next month">›</button>
      </div>
      <div className="cal" role="grid" aria-label={`${MONTH_NAMES[m - 1]} ${y}`}>
        {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
        {Array.from({ length: cells }, (_, i) => {
          const date = addDays(first, i - offset);
          const inMonth = date.slice(0, 7) === month;
          const day = BY_DATE.get(date);
          const ms = msByDate.get(date);
          const cls = ["cal-cell", !inMonth && "out", !day && "noplan", day && inMonth && `k-${day.kind}`, ms && "ms", date === today && "today", date === selected && "sel", day && isComplete(date) && "done"].filter(Boolean).join(" ");
          return (
            <button key={date} className={cls} onClick={() => onSelect(date)} aria-label={`${date}${ms ? `, ${ms.name}` : ""}${day ? `, ${day.title}` : ""}`} aria-pressed={date === selected}>
              <span className="n">{Number(date.slice(8))}</span>
              {ms && <span className="ms-tag">{ms.short}</span>}
              {day && isComplete(date) && day.kind !== "exam" && <span className="tick-done" aria-hidden="true">✓</span>}
              {day && <span className={`bar-kind k-${day.kind}`} />}
            </button>
          );
        })}
      </div>
      <div className="legend-line">
        <span><i style={{ background: "var(--blue)" }} />study</span>
        <span><i style={{ background: "var(--amber)" }} />short day</span>
        <span><i style={{ background: "var(--green)" }} />light</span>
        <span><i style={{ background: "var(--accent)" }} />mock</span>
        <span><i style={{ background: "var(--red)" }} />exam</span>
      </div>
    </div>
  );
}
