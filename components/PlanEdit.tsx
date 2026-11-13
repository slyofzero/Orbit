"use client";
import QPreview from "@/components/QPreview";
import { plainText } from "@/lib/richText";
import { useState } from "react";
import { KIND_LABEL, WEEKDAY_NAMES, fmtDate, todayIST, weekday } from "@/lib/plan";
import { KEYS, usePack, usePersisted, usePlan } from "@/lib/store";
import { Links } from "@/lib/links";
import PlanDescription from "./PlanDescription";
import PlanImport from "./PlanImport";
import { toast } from "@/lib/toast";
import { isDayLocked, LOCK_MESSAGE, useLockClock } from "@/lib/lock";
import Rich from "@/components/Rich";
import { Day, DayKind } from "@/lib/types";

type Row = { text: string; from: number | null }; // from = position before editing, so ticks follow their task
const KINDS = Object.keys(KIND_LABEL) as DayKind[];
let copiedLinks: string[] = []; // last copied set, kept in memory in case the clipboard can't be read
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Go through the plan day by day: edit, add or remove tasks, change a day's details, add or delete whole days.
export default function PlanEdit() {
  const { plan, update } = usePlan();
  const { topicById, pack } = usePack();
  const [done, setDone] = usePersisted<Record<string, boolean>>(KEYS.done, {});
  const [links, setLinks] = usePersisted<Links>(KEYS.links, {});
  const [open, setOpen] = useState<string | null>(null);
  const clock = useLockClock();
  const [draft, setDraft] = useState<(Omit<Day, "tasks" | "topics"> & { topics: string; rows: Row[]; linkQ: string[]; mock: string; note: string }) | null>(null);
  const [find, setFind] = useState("");
  const [newDate, setNewDate] = useState("");
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const [askDel, setAskDel] = useState(false);
  const [pastShown, setPastShown] = useState(2); // how many past days are listed: the latest 2 first, then 5 more per click

  const pick = (d: Day) => {
    if (open === d.date) { setOpen(null); setDraft(null); return; }
    setOpen(d.date); setAskDel(false); setErr("");
    setFind("");
    const l = links[d.date];
    setDraft({ ...d, topics: d.topics.join(", "), rows: d.tasks.map((t, i) => ({ text: t, from: i })), linkQ: l?.q ?? [], mock: l?.mock ?? "", note: l?.note ?? "" });
  };
  // copy / paste / clear all linked questions of the open day, to move them to another day
  const locked = !!draft && isDayLocked(draft.date, clock);
  const copyLinks = async () => {
    if (!draft || !draft.linkQ.length) return;
    const txt = draft.linkQ.join("\n");
    copiedLinks = draft.linkQ;
    try { await navigator.clipboard.writeText(txt); } catch { /* the in-app copy still works */ }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
    toast(`Copied ${draft.linkQ.length} linked question${draft.linkQ.length === 1 ? "" : "s"}. Open another day and press Paste links.`);
  };
  const pasteLinks = async () => {
    if (!draft || locked) return;
    let txt = "";
    try { txt = await navigator.clipboard.readText(); } catch { /* fall back below */ }
    let ids = txt.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    if (!ids.length || !ids.every((x) => pack.questions.some((q) => q.id === x))) ids = ids.filter((x) => pack.questions.some((q) => q.id === x)).length ? ids : copiedLinks;
    const known = ids.filter((x) => pack.questions.some((q) => q.id === x));
    const fresh = [...new Set(known)].filter((x) => !draft.linkQ.includes(x));
    if (!fresh.length) { setErr(ids.length ? "Those questions are already linked here, or not in your pack." : "Nothing to paste. Press Copy all links on another day first."); return; }
    setErr("");
    setDraft({ ...draft, linkQ: [...draft.linkQ, ...fresh] });
    toast(`Pasted ${fresh.length} link${fresh.length === 1 ? "" : "s"}${ids.length > known.length ? `, skipped ${ids.length - known.length} not in your pack` : ""}. Press Save changes to keep them.`);
  };
  const setRow = (i: number, v: Partial<Row>) => setDraft((p) => p && { ...p, rows: p.rows.map((r, j) => (j === i ? { ...r, ...v } : r)) });

  const save = () => {
    if (!draft || locked) return;
    const rows = draft.rows.map((r) => ({ ...r, text: r.text.trim() })).filter((r) => r.text);
    if (!draft.title.trim()) return setErr("Give the day a title.");
    if (!rows.length) return setErr("Keep at least one task, or delete the day.");
    const topics = draft.topics.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
    const unknown = topics.filter((t) => Object.keys(topicById).length && !topicById[t]);
    if (unknown.length) return setErr(`These topic ids are not in your pack: ${unknown.join(", ")}. Topics are the short ids like "linear-algebra".`);
    const day: Day = { date: draft.date, phase: draft.phase, kind: draft.kind, hours: Math.max(0, Number(draft.hours) || 0), title: draft.title.trim(), topics, tasks: rows.map((r) => r.text), targetQs: Math.max(0, Math.round(Number(draft.targetQs) || 0)) };
    update({ ...plan, days: plan.days.map((d) => (d.date === day.date ? day : d)) });
    const keepQ = [...new Set(draft.linkQ)];
    setLinks((p) => {
      const n = { ...p };
      if (keepQ.length || draft.mock || draft.note.trim()) n[day.date] = { q: keepQ, mock: draft.mock || undefined, note: draft.note.trim() || undefined };
      else delete n[day.date];
      return n;
    });
    // ticks follow their task when tasks are removed or added
    const old = plan.days.find((d) => d.date === day.date)!;
    setDone((p) => {
      const n = { ...p };
      old.tasks.forEach((_, i) => delete n[`${day.date}:${i}`]);
      rows.forEach((r, i) => { if (r.from !== null && p[`${day.date}:${r.from}`]) n[`${day.date}:${i}`] = true; });
      return n;
    });
    setErr(""); toast(`Saved ${fmtDate(day.date)}: ${rows.length} task${rows.length === 1 ? "" : "s"}, ${keepQ.length} linked question${keepQ.length === 1 ? "" : "s"}${draft.mock ? ", 1 mock test" : ""}. Your Today and Full plan pages are updated.`); setDraft({ ...draft, topics: topics.join(", "), rows: rows.map((r, i) => ({ text: r.text, from: i })) });
  };

  const del = () => {
    if (!draft || locked) return;
    update({ ...plan, days: plan.days.filter((d) => d.date !== draft.date) });
    setLinks((p) => { const n = { ...p }; delete n[draft.date]; return n; });
    setDone((p) => { const n = { ...p }; Object.keys(n).forEach((k) => k.startsWith(`${draft.date}:`) && delete n[k]); return n; });
    setOpen(null); setDraft(null); setAskDel(false); toast(`Deleted ${fmtDate(draft.date)}.`);
  };

  const add = () => {
    if (!ISO.test(newDate) || Number.isNaN(Date.parse(newDate))) return setErr("Pick a date first.");
    if (plan.days.some((d) => d.date === newDate)) return setErr("That date is already in your plan. Open it in the list to edit it.");
    const before = [...plan.days].reverse().find((d) => d.date < newDate) ?? plan.days[0];
    const day: Day = { date: newDate, phase: before?.phase ?? Object.keys(plan.phaseNames)[0] ?? "a", kind: "study", hours: 1, title: "New day", topics: [], tasks: ["New task"], targetQs: 0 };
    update({ ...plan, days: [...plan.days, day].sort((a, b) => a.date.localeCompare(b.date)) });
    setNewDate(""); setErr(""); toast(`Added ${fmtDate(newDate)}. Edit it below.`); pick(day);
  };

  return (
    <div className="pi pe-wide">
      <div className="pe-top">
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Edit your plan</h2>
        <p className="muted small">Open a day to change its title, hours, tasks or practice target. Changes keep your ticks, milestones and question links.</p>
        <PlanDescription />
        <div className="row">
          <input type="date" className="pe-in" value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-label="Date for the new day" />
          <button className="btn soft" onClick={add}>Add a day</button>
        </div>
        {!draft && err && <div className="pi-err" role="alert"><b>🔴 Fix this first:</b><ul><li>{err}</li></ul></div>}
      </section>
      <PlanImport editOnly onDone={() => {}} />
      </div>

      <div className="pr-list">
        {(() => {
          const today = todayIST();
          const past = plan.days.filter((d) => d.date < today);
          const rest = plan.days.filter((d) => d.date >= today);
          const row = (d: Day, isPast: boolean) => {
          const isOpen = open === d.date && draft;
          return (
            <div key={d.date} className={`drow ${isOpen ? "open" : ""} ${isPast ? "past" : ""}`}>
              <button className="drow-head" onClick={() => pick(d)} aria-expanded={!!isOpen}>
                <span className="pl-date sm"><b>{Number(d.date.slice(8))}</b><small>{WEEKDAY_NAMES[weekday(d.date)]}</small></span>
                <span className="nm"><Rich text={d.title} /></span>
                <span className={`pill k-${d.kind}`}>{KIND_LABEL[d.kind]}</span>
                <span className="small muted st">{fmtDate(d.date)}</span>
              </button>
              {isOpen && draft && (
                <div className="drow-body pe">
                  {locked && (
                    <div className="pe-lock" role="status">
                      <span>🔒 {LOCK_MESSAGE}</span>
                      <button className="btn soft" onClick={copyLinks} disabled={!draft.linkQ.length}>Copy today's links</button>
                    </div>
                  )}
                  <fieldset className="pe-fs" disabled={locked}>
                  <label className="pe-f">Title<input className="pe-in" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
                  <div className="pe-grid">
                    <label className="pe-f">Type<select className="pe-in" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as DayKind })}>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
                    <label className="pe-f">Hours<input className="pe-in" type="number" min={0} step={0.5} value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: Number(e.target.value) })} /></label>
                    <label className="pe-f">Practice target (questions)<input className="pe-in" type="number" min={0} value={draft.targetQs} onChange={(e) => setDraft({ ...draft, targetQs: Number(e.target.value) })} /></label>
                  </div>
                  <label className="pe-f">Topic ids, separated by commas<input className="pe-in" value={draft.topics} onChange={(e) => setDraft({ ...draft, topics: e.target.value })} placeholder="e.g. linear-algebra, probability" /></label>
                  <div className="pe-f">Tasks
                    {draft.rows.map((r, i) => (
                      <div key={i} className="pe-task">
                        <input className="pe-in" value={r.text} onChange={(e) => setRow(i, { text: e.target.value })} aria-label={`Task ${i + 1}`} />
                        <button className="btn soft ic" data-tip="Remove task" onClick={() => setDraft({ ...draft, rows: draft.rows.filter((_, j) => j !== i) })} aria-label={`Remove task ${i + 1}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /><path d="M10 11v5M14 11v5" /></svg></button>
                      </div>
                    ))}
                    <button className="btn soft" style={{ justifySelf: "start" }} onClick={() => setDraft({ ...draft, rows: [...draft.rows, { text: "", from: null }] })}>Add a task</button>
                  </div>
                  <div className="pe-f pe-links"><div className="pe-linkhead"><span>Linked questions for this day</span>
                    <div className="pe-linkbar">
                      <button className={`btn inv ic ${copied ? "copied" : ""}`} data-tip={copied ? "Copied!" : "Copy all links"} aria-label="Copy all links" onClick={copyLinks} disabled={!draft.linkQ.length}>{copied ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>}</button>
                      <button className="btn inv ic" data-tip="Paste links" aria-label="Paste links" onClick={pasteLinks}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4h6v3H9z" /><path d="M9.5 13h5M9.5 17h5" /></svg></button>
                      <button className="btn inv ic" data-tip="Delete all links" aria-label="Delete all links" onClick={() => { setDraft({ ...draft, linkQ: [] }); toast("Removed all links. Press Save changes to keep that."); }} disabled={!draft.linkQ.length}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /><path d="M10 11v5M14 11v5" /></svg></button>
                    </div></div>
                    {draft.linkQ.length === 0 && (
                      <div className="pe-empty">
                        <b>No questions linked to this day yet</b>
                        <span className="small muted">Search for questions below, use Link with AI, or press the paste icon above to bring over links copied from another day.</span>
                      </div>
                    )}
                    {draft.linkQ.map((id) => {
                      const q = pack.questions.find((x) => x.id === id);
                      return (
                        <div key={id} className="pe-task">
                          <span className="pe-qid">{id}</span>
                          <span className="small muted pe-qtext">{q ? <>{topicById[q.topic]?.name ?? q.topic}: <QPreview text={q.text} max={80} /></> : "No longer in your pack"}</span>
                          <button className="btn soft ic" data-tip="Unlink" onClick={() => setDraft({ ...draft, linkQ: draft.linkQ.filter((x) => x !== id) })} aria-label={`Unlink ${id}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                        </div>
                      );
                    })}
                    <input className="pe-in" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a question to add: type part of its id, topic or text" aria-label="Find a question to add" />
                    {find.trim() && (() => {
                      const n = find.trim().toLowerCase();
                      const hits = pack.questions.filter((q) => !draft.linkQ.includes(q.id) && (q.id.toLowerCase().includes(n) || q.topic.toLowerCase().includes(n) || plainText(q.text).toLowerCase().includes(n))).slice(0, 8);
                      return hits.length === 0 ? <span className="small muted">No match in your practice questions.</span> : hits.map((q) => (
                        <div key={q.id} className="pe-task">
                          <span className="pe-qid">{q.id}</span>
                          <span className="small muted pe-qtext"><QPreview text={q.text} max={80} /></span>
                          <button className="btn soft" onClick={() => setDraft({ ...draft, linkQ: [...draft.linkQ, q.id] })}>Add</button>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="pe-grid">
                    <label className="pe-f">Mock test for this day<select className="pe-in" value={draft.mock} onChange={(e) => setDraft({ ...draft, mock: e.target.value })}><option value="">None</option>{pack.mockTests.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
                    <label className="pe-f" style={{ gridColumn: "span 2" }}>Note shown with the questions<input className="pe-in" value={draft.note} maxLength={100} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
                  </div>
                  {err && <div className="pi-err" role="alert"><b>🔴 Fix this first:</b><ul><li>{err}</li></ul></div>}
                  <div className="row">
                    <button className="btn primary" onClick={save}>Save this day</button>
                    {askDel ? (
                      <>
                        <div className="callout" style={{ flex: 1 }}>🔴 CAUTION: This deletes the day, its ticks and its linked questions and mock. Your answers are kept.</div>
                        <button className="btn" onClick={del}>Yes, delete the day</button>
                        <button className="btn soft" onClick={() => setAskDel(false)}>Keep it</button>
                      </>
                    ) : <button className="btn soft right" onClick={() => setAskDel(true)}>Delete this day</button>}
                  </div>
                  </fieldset>
                </div>
              )}
            </div>
          );
          };
          return (
            <>
              {past.length > 0 && (
                <>
                  <p className="small muted pe-past-h">Past days ({Math.min(pastShown, past.length)} of {past.length})</p>
                  {past.length > pastShown && (
                    <button className="btn soft pe-more" onClick={() => setPastShown((n) => n + 5)}>
                      Show {Math.min(5, past.length - pastShown)} earlier {Math.min(5, past.length - pastShown) === 1 ? "day" : "days"}
                    </button>
                  )}
                  {past.slice(-pastShown).map((d) => row(d, true))}
                  <hr className="pe-sep" />
                </>
              )}
              {rest.map((d) => row(d, false))}
            </>
          );
        })()}
      </div>
    </div>
  );
}
