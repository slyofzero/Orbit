"use client";
import { CSSProperties, ReactNode } from "react";
import { Milestone, addDays, daysBetween } from "@/lib/plan";
import Count from "./Count";

export type TickState = "done" | "miss" | "plain";

// The whole stretch from today (or day 1 of the plan) to your last milestone, one tick per day, milestones planted on it.
export default function Runway({
  today, start, milestones, tickState, planNote, stats,
}: { today: string; start: string; milestones: Milestone[]; tickState: (date: string) => TickState; planNote: string; stats?: ReactNode }) {
  const upcoming = milestones.filter((m) => daysBetween(today, m.date) >= 0);
  const next = upcoming[0];
  const after = upcoming.slice(1);
  const end = milestones.length ? milestones[milestones.length - 1].date : today;
  const total = Math.max(1, daysBetween(start, end) + 1);
  const msByDate = new Map(milestones.map((m) => [m.date, m]));
  const n = next ? daysBetween(today, next.date) : 0;

  return (
    <section className="runway" aria-label="Countdown to your milestones">
      <div className="runway-top">
        <div>
          <h1>
            {!milestones.length
              ? "Add a milestone to start the countdown"
              : !next
                ? "Every milestone is behind you"
                : n === 0
                  ? <>{next.name} is today</>
                  : n === 1
                    ? <>{next.name} is tomorrow</>
                    : <>{next.name} is in <Count n={n} /> days</>}
          </h1>
          <p className="sub">
            {planNote}
            {after.length > 0 && ` After that: ${after.slice(0, 3).map((m) => `${m.name} in ${daysBetween(today, m.date)} days`).join(", ")}${after.length > 3 ? ` and ${after.length - 3} more` : ""}.`}
          </p>
        </div>
        {stats && <div className="hero-stats">{stats}</div>}
      </div>
      {milestones.length > 0 && (
        <div className="track">
          <div className="ticks" role="presentation">
            {Array.from({ length: total }, (_, i) => {
              const d = addDays(start, i);
              let cls = "";
              if (msByDate.has(d)) cls = "ms";
              else if (d === today) cls = "today";
              else if (d < today) cls = tickState(d) === "done" ? "done" : tickState(d) === "miss" ? "miss" : "past";
              return <i key={d} className={`tick ${cls}`} style={{ "--i": i } as CSSProperties} />;
            })}
          </div>
          {milestones.map((m, k) => {
            const idx = daysBetween(start, m.date);
            if (idx < 0 || idx >= total) return null;
            const pct = ((idx + 0.5) / total) * 100;
            const d = daysBetween(today, m.date);
            return (
              <div key={m.id} className={`flag lv${k % 2} ${pct > 74 ? "flip" : ""} ${next?.id === m.id ? "next" : ""}`} style={{ left: `${pct}%` }}>
                <b>{m.name}</b>
                <span className="long">{d < 0 ? "passed" : d === 0 ? "today" : `${d} day${d > 1 ? "s" : ""} to go`}</span>
                <span className="short">{d < 0 ? "passed" : d === 0 ? "today" : `${d}d`}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
