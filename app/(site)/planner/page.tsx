"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import PlanImport from "@/components/PlanImport";
import { KIND_LABEL, WEEKDAY_NAMES, addDays, daysBetween, fmtDate, fmtLong, todayIST, weekday } from "@/lib/plan";
import { KEYS, usePack, usePersisted, usePlan } from "@/lib/store";
import { burst } from "@/lib/fx";
import { PracticeRec } from "@/lib/types";
import { Day } from "@/lib/types";

type View = "next" | "all" | "missed" | "plan";
type Done = Record<string, boolean>;

const istDay = (at: number) => new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function DayBody({ d, done, setDone, qs }: { d: Day; done: Done; setDone: (u: (p: Done) => Done) => void; qs: number }) {
  const { topicById: TOPIC_BY_ID } = usePack();
  const complete = d.tasks.every((_, i) => done[`${d.date}:${i}`]);
  const tick = (i: number, checked: boolean, el: HTMLInputElement) => {
    setDone((p) => ({ ...p, [`${d.date}:${i}`]: checked }));
    if (!checked) return;
    const r = el.getBoundingClientRect();
    const all = d.tasks.every((_, j) => j === i || done[`${d.date}:${j}`]);
    burst(r.left + r.width / 2, r.top + r.height / 2, all ? 60 : 12);
  };
  return (
    <>
      {d.tasks.map((t, i) => (
        <label key={i} className={`task ${done[`${d.date}:${i}`] ? "done" : ""}`}>
          <input type="checkbox" checked={!!done[`${d.date}:${i}`]} onChange={(e) => tick(i, e.target.checked, e.currentTarget)} />
          <span>{t}</span>
        </label>
      ))}
      {d.targetQs > 0 && (
        <div className="pl-target">
          <div className="small muted">Practice target: {Math.min(qs, d.targetQs)} of {d.targetQs} questions</div>
          <div className="bar"><div style={{ width: `${Math.min(100, (qs / d.targetQs) * 100)}%` }} /></div>
        </div>
      )}
      <div className="row pl-links">
        {d.topics.filter((t) => TOPIC_BY_ID[t]).slice(0, 4).map((t) => (
          <Link key={t} href={`/practice/${t}`} className={`pill ${TOPIC_BY_ID[t]?.status}`}>{TOPIC_BY_ID[t]?.name.split("(")[0].trim()}</Link>
        ))}
        {d.kind === "mock" && <Link className="btn primary" href="/mocks">Start the mock</Link>}
        <button className="btn soft right" onClick={() => setDone((p) => { const n = { ...p }; d.tasks.forEach((_, i) => (n[`${d.date}:${i}`] = !complete)); return n; })}>
          {complete ? "Untick all" : "Tick all"}
        </button>
      </div>
    </>
  );
}

export default function Planner() {
  const { plan, ready: planReady } = usePlan();
  const DAYS = plan.days;
  const PHASE_NAMES = plan.phaseNames;
  const [done, setDone, ready] = usePersisted<Done>(KEYS.done, {});
  const [practice] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [view, setView] = useState<View>("next");
  const [openDay, setOpenDay] = useState<Record<string, boolean>>({});
  const [openPhase, setOpenPhase] = useState<Record<string, boolean> | null>(null);
  const today = todayIST();
  useEffect(() => { if (new URLSearchParams(window.location.search).get("tab") === "plan") setView("plan"); }, []);

  if (!ready || !planReady) return <p className="muted">Loading…</p>;

  if (!plan.days.length) {
    return (
      <>
        <h1>Planner</h1>
        <div className="panel" style={{ marginBottom: 18 }}>
          <h2 style={{ marginTop: 0 }}>No plan yet</h2>
          <p className="muted" style={{ margin: 0 }}>Upload a plan and this page fills with what to do each day, with your milestones and phases. Nothing is built in.</p>
        </div>
        <PlanImport onDone={() => setView("next")} />
      </>
    );
  }

  const recs = Object.values(practice);
  const answeredOn = (date: string) => recs.filter((r) => istDay(r.at) === date).length;
  const nDone = (d: Day) => d.tasks.filter((_, i) => done[`${d.date}:${i}`]).length;
  const complete = (d: Day) => nDone(d) === d.tasks.length;
  const missed = DAYS.filter((d) => d.date < today && !complete(d) && d.kind !== "exam");

  // three calendar days: today and the next two
  const three = [0, 1, 2].map((i) => addDays(today, i));
  const labelFor = (date: string) => (date === today ? "Today" : date === addDays(today, 1) ? "Tomorrow" : WEEKDAY_NAMES[weekday(date)] === "Sun" ? "Sunday" : fmtLong(date).split(" ")[0]);

  const phases = Object.keys(PHASE_NAMES).map((ph, pi) => {
    const ds = DAYS.filter((d) => d.phase === ph);
    const total = ds.reduce((s, d) => s + d.tasks.length, 0);
    const got = ds.reduce((s, d) => s + nDone(d), 0);
    return { ph, ds, total, got, current: ds.some((d) => d.date === today) || (today < ds[0].date && pi === 0) };
  });
  const phaseOpen = (ph: string, current: boolean) => (openPhase ? !!openPhase[ph] : current);

  const DayCard = ({ date }: { date: string }) => {
    const d = DAYS.find((x) => x.date === date);
    const n = daysBetween(today, date);
    return (
      <section className={`panel pl-card ${n === 0 ? "now" : ""}`}>
        <div className="pl-top">
          <span className="pl-date"><b>{Number(date.slice(8))}</b><small>{WEEKDAY_NAMES[weekday(date)]}</small></span>
          <div>
            <h2>{labelFor(date)}</h2>
            <span className="muted small">{fmtLong(date)}</span>
          </div>
          {d && <span className={`pill k-${d.kind} right`}>{KIND_LABEL[d.kind]}</span>}
        </div>
        {d ? (
          <>
            <p className="pl-title">{d.title}{d.hours > 0 && <span className="muted small"> · {d.hours} h</span>}</p>
            <DayBody d={d} done={done} setDone={setDone} qs={answeredOn(date)} />
          </>
        ) : (
          <p className="muted">
            Nothing is planned for this day.{" "}
            {date < DAYS[0].date ? `Your plan starts on ${fmtDate(DAYS[0].date)}.` : date > DAYS[DAYS.length - 1].date ? "The plan has ended." : ""}
          </p>
        )}
      </section>
    );
  };

  const Row = ({ d }: { d: Day }) => {
    const isOpen = openDay[d.date] ?? false;
    const c = complete(d);
    const miss = d.date < today && !c && d.kind !== "exam";
    return (
      <div className={`drow ${d.date === today ? "today" : ""} ${miss ? "miss" : ""} ${isOpen ? "open" : ""}`}>
        <button className="drow-head" onClick={() => setOpenDay((p) => ({ ...p, [d.date]: !isOpen }))} aria-expanded={isOpen}>
          <span className="pl-date sm"><b>{Number(d.date.slice(8))}</b><small>{WEEKDAY_NAMES[weekday(d.date)]}</small></span>
          <span className="nm">{d.title}</span>
          <span className={`pill k-${d.kind}`}>{KIND_LABEL[d.kind]}</span>
          <span className="small muted st">{c ? "✓" : `${nDone(d)}/${d.tasks.length}`}</span>
        </button>
        {isOpen && <div className="drow-body"><DayBody d={d} done={done} setDone={setDone} qs={answeredOn(d.date)} /></div>}
      </div>
    );
  };

  return (
    <>
      <div className="row" style={{ alignItems: "baseline" }}>
        <h1>Planner</h1>
        <button className="btn soft right" onClick={() => setView((v) => (v === "plan" ? "next" : "plan"))}>{view === "plan" ? "Back to planner" : "Upload plan"}</button>
      </div>
      <p className="muted small" style={{ marginTop: -6 }}>{plan.name}</p>
      {view !== "plan" && <div className="tabs">
        <button className={view === "next" ? "on" : ""} onClick={() => setView("next")}>Next 3 days</button>
        <button className={view === "all" ? "on" : ""} onClick={() => setView("all")}>Full plan</button>
        <button className={view === "missed" ? "on" : ""} onClick={() => setView("missed")}>Missed{missed.length ? ` (${missed.length})` : ""}</button>
      </div>}

      {view === "plan" && <PlanImport onDone={() => setView("next")} />}

      {view === "next" && (
        <div className="pl-focus">
          {three.map((d, i) => <div key={d} className="pl-wrap" style={{ "--n": i } as React.CSSProperties}><DayCard date={d} /></div>)}
        </div>
      )}

      {view === "missed" && (
        missed.length === 0 ? <div className="panel muted">No missed days. Nice.</div> : <div className="pl-rows">{missed.map((d) => <Row key={d.date} d={d} />)}</div>
      )}

      {view === "all" && (
        <div className="pr-list">
          {phases.map(({ ph, ds, total, got, current }) => {
            const o = phaseOpen(ph, current);
            const weeks: { key: string; days: Day[] }[] = [];
            for (const d of ds) {
              const ws = addDays(d.date, -((weekday(d.date) + 6) % 7));
              const last = weeks[weeks.length - 1];
              last && last.key === ws ? last.days.push(d) : weeks.push({ key: ws, days: [d] });
            }
            return (
              <section key={ph} className={`pr-sub ${o ? "open" : ""}`}>
                <button className="pr-head" aria-expanded={o} onClick={() => setOpenPhase((p) => ({ ...(p ?? Object.fromEntries(phases.map((x) => [x.ph, x.current]))), [ph]: !o }))}>
                  <span className="chev" aria-hidden="true">›</span>
                  <h2>{PHASE_NAMES[ph]}</h2>
                  <span className="muted small">{fmtDate(ds[0].date)} to {fmtDate(ds[ds.length - 1].date)}</span>
                  <span className="pl-mini bar"><div style={{ width: `${total ? (got / total) * 100 : 0}%` }} /></span>
                </button>
                {o && (
                  <div className="pl-phase-body">
                    {weeks.map((w) => (
                      <div key={w.key}>
                        <div className="week-title">Week of {fmtDate(w.key)}</div>
                        <div className="pl-rows">{w.days.map((d) => <Row key={d.date} d={d} />)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
