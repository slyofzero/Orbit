"use client";
import Link from "next/link";
import { CSSProperties, useEffect, useRef, useState } from "react";
import Calendar from "@/components/Calendar";
import Runway from "@/components/Runway";
import Milestones from "@/components/Milestones";
import QuoteCard from "@/components/QuoteCard";
import { burst } from "@/lib/fx";
import { KIND_LABEL, Milestone, WEEKDAY_NAMES, addDays, daysBetween, fmtDate, fmtLong, todayIST, weekday } from "@/lib/plan";
import { DEFAULT_SETTINGS, KEYS, clearAll, exportAll, importAll, inspectBackup, useMilestones, usePack, usePersisted, usePlan } from "@/lib/store";
import { Attempt, PracticeRec, Settings } from "@/lib/types";
import { marksFor } from "@/lib/scoring";

const inDays = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

export default function Dashboard() {
  const [settings, setSettings, ready] = usePersisted<Settings>(KEYS.settings, DEFAULT_SETTINGS);
  const [done, setDone] = usePersisted<Record<string, boolean>>(KEYS.done, {});
  const [practice] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [attempts] = usePersisted<Attempt[]>(KEYS.attempts, []);
  const today = todayIST();
  const [selected, setSelected] = useState(today);
  const [wipe, setWipe] = useState(false);
  const [restore, setRestore] = useState<null | { text: string; when?: string } | { error: string }>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ms = useMilestones();
  const { plan, custom, ready: planReady } = usePlan();
  const { pack, custom: hasPack, ready: packReady } = usePack();
  const TOPICS = pack.topics;
  const DAYS = plan.days;
  const PLAN_START = DAYS[0]?.date ?? today;
  const [toast, setToast] = useState<{ text: string; undo: Milestone[] } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!ready || !ms.ready || !planReady || !packReady) return <p className="muted">Loading…</p>;

  const milestones = ms.milestones;
  const isComplete = (date: string) => {
    const d = DAYS.find((x) => x.date === date);
    return !!d && d.tasks.every((_, i) => done[`${date}:${i}`]);
  };
  const tickState = (date: string) => {
    const d = DAYS.find((x) => x.date === date);
    if (!d || d.kind === "exam") return "plain" as const;
    return isComplete(date) ? ("done" as const) : ("miss" as const);
  };

  // plan stats
  const dueDays = DAYS.filter((d) => d.date <= today);
  const totalTasks = DAYS.reduce((s, d) => s + d.tasks.length, 0);
  const doneTasks = Object.keys(done).filter((k) => done[k]).length;
  const dueTasks = dueDays.reduce((s, d) => s + d.tasks.length, 0);
  const dueDone = dueDays.reduce((s, d) => s + d.tasks.filter((_, i) => done[`${d.date}:${i}`]).length, 0);
  const open = dueTasks - dueDone;

  const recs = Object.values(practice);
  const accuracy = recs.length ? Math.round((recs.filter((r) => r.correct).length / recs.length) * 100) : 0;
  const answeredOn = (date: string) => recs.filter((r) => new Date(r.at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === date).length;

  const finished = attempts.filter((a) => a.submittedAt && !a.failed).sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
  const scoreOf = (a: Attempt) => a.questions.reduce((s, q, i) => s + marksFor(q, a.responses[i]?.ans), 0);
  const maxOf = (a: Attempt) => a.questions.reduce((s, q) => s + q.marks, 0);

  const byTopic: Record<string, { c: number; n: number }> = {};
  for (const r of recs) {
    byTopic[r.topic] ??= { c: 0, n: 0 };
    byTopic[r.topic].n++;
    if (r.correct) byTopic[r.topic].c++;
  }
  const weakest = Object.entries(byTopic).filter(([, v]) => v.n >= 3).map(([t, v]) => ({ t, acc: v.c / v.n, n: v.n })).sort((a, b) => a.acc - b.acc).slice(0, 5);

  // runway framing
  const planIdx = DAYS.findIndex((d) => d.date === today);
  const planNote =
    !DAYS.length
      ? "Load a plan to see your daily targets here."
      : today < PLAN_START
      ? `Your plan starts ${inDays(daysBetween(today, PLAN_START))}: ${DAYS[0].title}.`
      : planIdx >= 0
        ? `Day ${planIdx + 1} of ${DAYS.length}. ${DAYS[planIdx].tasks.filter((_, i) => !done[`${today}:${i}`]).length} tasks left today.`
        : "The plan is finished. Keep revising your mistake log.";
  const runwayStart = today < PLAN_START ? today : PLAN_START;

  // agenda for the selected date
  const day = DAYS.find((d) => d.date === selected);
  const nextPlanned = DAYS.find((d) => d.date > selected);
  const upcoming = DAYS.filter((d) => d.date > today && d.date !== selected).slice(0, 4);
  const targetDone = day ? Math.min(answeredOn(selected), day.targetQs) : 0;

  // activity: ticked tasks + answered questions per day
  const istDay = (at: number) => new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const activity: Record<string, number> = {};
  for (const k of Object.keys(done)) if (done[k]) activity[k.slice(0, 10)] = (activity[k.slice(0, 10)] ?? 0) + 1;
  for (const r of recs) activity[istDay(r.at)] = (activity[istDay(r.at)] ?? 0) + 1;
  let streak = 0;
  for (let d = activity[today] ? today : addDays(today, -1); activity[d]; d = addDays(d, -1)) streak++;
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const weekMax = Math.max(4, ...week.map((d) => activity[d] ?? 0));
  const todayDay = DAYS.find((d) => d.date === today);
  const todayDone = todayDay ? todayDay.tasks.filter((_, i) => done[`${today}:${i}`]).length : 0;
  const todayTotal = todayDay ? todayDay.tasks.length : 0;
  const frac = todayTotal ? todayDone / todayTotal : 0;
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  const hello = hour < 5 ? "Burning the midnight oil" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const R = 22, C = 2 * Math.PI * R;

  const heroStats = (
    <>
      <div className="hs" title="Tasks ticked today">
        <svg className="ring" viewBox="0 0 52 52" aria-hidden="true">
          <circle className="bg" cx="26" cy="26" r={R} /><circle className="fg" cx="26" cy="26" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
        </svg>
        <div><b>{todayTotal ? `${todayDone}/${todayTotal}` : "Rest"}</b><small>{todayTotal ? "tasks today" : "no plan today"}</small></div>
      </div>
      <div className="hs" title="Days in a row with a ticked task or answered question">
        <svg className={`flame ${streak ? "on" : "off"}`} viewBox="0 0 40 40" aria-hidden="true">
          <path d="M20 3c1 6 9 10 9 20a9 9 0 01-18 0c0-4 2-6 3-8 1 3 3 4 4 4-1-6 0-12 2-16z" /><path className="in" d="M20 20c1 3 5 4 5 8a5 5 0 01-10 0c0-2 1-3 2-4 1 1 2 1 2 1-.5-2-.5-4 1-5z" />
        </svg>
        <div><b>{streak}</b><small>{streak === 1 ? "day streak" : "day streak"}</small></div>
      </div>
    </>
  );

  const tick = (key: string, checked: boolean, el: HTMLInputElement) => {
    setDone((p) => ({ ...p, [key]: checked }));
    if (!checked || !day) return;
    const r = el.getBoundingClientRect();
    const allDone = day.tasks.every((_, i) => `${day.date}:${i}` === key || done[`${day.date}:${i}`]);
    burst(r.left + r.width / 2, r.top + r.height / 2, allDone ? 70 : 14);
  };

  let n = 0;
  const stag = () => ({ "--n": n++ } as CSSProperties);

  return (
    <>
      <div className="greet">
        <h2 style={{ margin: 0 }}>{hello}{settings.name.trim() && <>, <span>{settings.name}</span></>}</h2>
        <span className="date">{fmtLong(today)}</span>
      </div>

      <QuoteCard />

      {(!custom || !hasPack) && (
        <section className="panel welcome">
          <div>
            <h2 style={{ margin: "0 0 4px" }}>Set up your study space</h2>
            <p className="muted" style={{ margin: 0 }}>Nothing is loaded yet, so the calendar, planner, practice and mocks are empty. Upload a plan for your daily targets and a question pack for practice and mock tests.</p>
          </div>
          <div className="row">
            {!custom && <Link className="btn primary" href="/planner?tab=plan">Load a plan</Link>}
            {!hasPack && <Link className="btn primary" href="/practice">Load a question pack</Link>}
          </div>
        </section>
      )}

      <div className="dash">
      <div className="d-hero" style={stag()}>
        <Runway today={today} start={runwayStart} milestones={milestones} tickState={tickState} planNote={planNote} stats={heroStats} />
      </div>

      <div className="d-main">
      <div className="panel d-cal" style={stag()}>
        <Calendar days={DAYS} today={today} selected={selected} onSelect={setSelected} milestones={milestones} isComplete={isComplete} />
      </div>

        <section className="agenda d-agenda" aria-live="polite" style={stag()}>
          <div className="when">{selected === today ? "Today" : fmtLong(selected)}</div>
          <div className="meta row">
            {selected === today && <span className="muted">{fmtLong(today)}</span>}
            {day && <span className={`pill k-${day.kind}`}>{KIND_LABEL[day.kind]}</span>}
            {day && day.hours > 0 && <span className="muted small">{day.hours} h planned</span>}
            {selected !== today && <button className="btn soft" onClick={() => setSelected(today)}>Back to today</button>}
          </div>

          {day ? (
            <>
              <p style={{ fontWeight: 700, fontSize: "1.1rem" }}>{day.title}</p>
              {day.tasks.map((t, i) => {
                const key = `${day.date}:${i}`;
                return (
                  <label key={key} className={`task ${done[key] ? "done" : ""}`}>
                    <input type="checkbox" checked={!!done[key]} onChange={(e) => tick(key, e.target.checked, e.currentTarget)} />
                    <span>{t}</span>
                  </label>
                );
              })}
              {day.targetQs > 0 && (
                <div className="foot">
                  <div className="small muted">Practice target: {targetDone} of {day.targetQs} questions</div>
                  <div className="bar"><div style={{ width: `${(targetDone / day.targetQs) * 100}%` }} /></div>
                </div>
              )}
              <div className="foot row">
                {day.topics.filter((t) => TOPICS.some((x) => x.id === t)).slice(0, 3).map((t) => (
                  <Link key={t} className="btn soft" href={`/practice/${t}`}>Practise {TOPICS.find((x) => x.id === t)?.name.split("(")[0].trim()}</Link>
                ))}
                {day.kind === "mock" && <Link className="btn primary" href="/mocks">Start the mock</Link>}
              </div>
            </>
          ) : (
            <div className="foot">
              <p>Nothing is planned for this day.</p>
              {nextPlanned && (
                <>
                  <p className="muted">The next planned day is {fmtDate(nextPlanned.date)}: {nextPlanned.title}.</p>
                  <button className="btn primary" onClick={() => setSelected(nextPlanned.date)}>Open {fmtDate(nextPlanned.date)}</button>
                </>
              )}
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="upcoming">
              <h3>Coming up</h3>
              {upcoming.map((u) => (
                <button key={u.date} className="up-row" onClick={() => setSelected(u.date)}>
                  <span className="d"><b>{Number(u.date.slice(8))}</b><small>{WEEKDAY_NAMES[weekday(u.date)]}</small></span>
                  <span className="t">{u.title}</span>
                  <span className={`pill k-${u.kind}`}>{KIND_LABEL[u.kind]}</span>
                </button>
              ))}
            </div>
          )}
        </section>

      <section className="panel d-third" style={stag()}>
        <h2>Last 7 days</h2>
        <div className="week">
          {week.map((d, i) => {
            const v = activity[d] ?? 0;
            return (
              <div key={d} className={`col ${d === today ? "today" : ""}`} title={`${fmtDate(d)}: ${v} done`}>
                <div className={`b ${v ? "" : "zero"}`} style={{ height: `${v ? Math.max(10, (v / weekMax) * 100) : 6}%`, "--i": i } as CSSProperties} />
                <small>{WEEKDAY_NAMES[weekday(d)].slice(0, 1)}</small>
              </div>
            );
          })}
        </div>
        <p className="small muted" style={{ margin: "10px 0 0" }}>Ticked tasks plus answered questions, per day.</p>
      </section>

      <section className="panel d-third" style={stag()}>
        <h2>Mock scores</h2>
        {finished.length === 0 ? (
          <p className="muted">No mocks yet. <Link href="/mocks">Take a diagnostic mock</Link> to see where you start.</p>
        ) : (
          <table className="t">
            <tbody>
              {finished.slice(0, 5).map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/results/${a.id}`}>{a.title}</Link></td>
                  <td className="muted">{new Date(a.submittedAt!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                  <td><b>{scoreOf(a).toFixed(1)}</b> / {maxOf(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel d-third" style={stag()}>
        <h2>Weakest topics</h2>
        {weakest.length === 0 ? (
          <p className="muted">Answer at least 3 questions in a topic and it shows up here.</p>
        ) : (
          weakest.map((w) => (
            <div key={w.t} style={{ marginBottom: 10 }}>
              <div className="row"><Link href={`/practice/${w.t}`}>{TOPICS.find((x) => x.id === w.t)?.name}</Link><span className="right small muted">{Math.round(w.acc * 100)}% of {w.n}</span></div>
              <div className="bar"><div style={{ width: `${w.acc * 100}%`, background: w.acc < 0.5 ? "var(--red)" : "var(--amber)" }} /></div>
            </div>
          ))
        )}
      </section>
      </div>

      <div className="d-side" style={stag()}>
        <Milestones today={today} milestones={milestones} api={ms}
          onRemoved={(m) => setToast({ text: `Removed ${m.name}`, undo: [...milestones] })} />

        <section className="panel">
          <h2>Where you stand</h2>
          <div className="chips">
            <div className="chip c1"><b>{doneTasks}</b><span>of {totalTasks} plan tasks</span></div>
            <div className="chip c2"><b>{recs.length}</b><span>questions{recs.length ? `, ${accuracy}% right` : ""}</span></div>
            <div className="chip c3"><b>{finished.length}</b><span>mock{finished.length === 1 ? "" : "s"} taken</span></div>
          </div>
          <div className="bar good" style={{ margin: "14px 0 8px" }}><div style={{ width: `${totalTasks ? (doneTasks / totalTasks) * 100 : 0}%` }} /></div>
          <p className="small muted" style={{ margin: 0 }}>
            {!DAYS.length ? "No plan loaded yet." : today < PLAN_START ? "Nothing is due yet." : open > 0 ? `${open} due so far ${open === 1 ? "is" : "are"} still open.` : "Everything due so far is done."}{" "}
            {TOPICS.length > 0 && <>Of {TOPICS.length} topics, {TOPICS.filter((t) => t.status === "noidea").length} are new to you and {TOPICS.filter((t) => t.status === "shaky").length} are shaky.</>}
          </p>
        </section>
      </div>

      </div>

      {toast && (
        <div className="toast" role="status">
          {toast.text}
          <button onClick={() => { ms.restore(toast.undo); setToast(null); }}>Undo</button>
        </div>
      )}

      <details className="card flat">
        <summary>Settings and backup</summary>
        <div className="row" style={{ marginTop: 14 }}>
          <label>Your name <input type="text" placeholder="Optional" value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} /></label>
          <button className="btn soft" onClick={() => ms.reset()}>Reset milestones to the plan's own</button>
          <Link className="btn soft" href="/planner?tab=plan">Change plan</Link>
          {!wipe ? <button className="btn soft" onClick={() => setWipe(true)}>Start fresh</button> : (
            <>
              <span className="small">Deletes your plan, pack, ticks, practice, mocks and milestones.</span>
              <button className="btn primary" onClick={() => clearAll()}>Yes, delete everything</button>
              <button className="btn soft" onClick={() => setWipe(false)}>Cancel</button>
            </>
          )}
          <button className="btn soft" onClick={async () => {
            const blob = new Blob([await exportAll()], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `gate-progress-${todayIST()}.json`;
            a.click();
          }}>Export progress</button>
          <button className="btn soft" onClick={() => fileRef.current?.click()}>Import progress</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const text = await f.text();
            const r = inspectBackup(text);
            setRestore(r.ok ? { text, when: r.when } : { error: r.error });
          }} />
          {restore && ("error" in restore ? (
            <div className="pi-err" role="alert" style={{ flexBasis: "100%" }}><b>🔴 Fix this first:</b><ul><li>{restore.error}</li></ul><button className="btn soft" onClick={() => setRestore(null)}>Close</button></div>
          ) : (
            <div className="callout" style={{ flexBasis: "100%" }}>
              🔴 CAUTION: Restoring replaces everything on this profile (plan, questions, links, ticks, practice, mocks, settings) with the backup{restore.when ? ` made on ${new Date(restore.when).toLocaleString()}` : ""}. Anything newer is lost.
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn primary" onClick={() => importAll(restore.text)}>Yes, restore this backup</button>
                <button className="btn soft" onClick={() => setRestore(null)}>Cancel</button>
              </div>
            </div>
          ))}
        </div>
        <div className="callout">🔴 CAUTION: Your progress lives in this browser only. Do NOT clear site data without exporting first.</div>
      </details>
    </>
  );
}
