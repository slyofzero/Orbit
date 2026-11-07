"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SUBJECTS, TOPICS } from "@/lib/topics";
import { BANK, hasGenerator } from "@/lib/bank";
import { DAYS, fmtDate, todayIST } from "@/lib/plan";
import { KEYS, usePersisted } from "@/lib/store";
import { PracticeRec, TopicStatus } from "@/lib/types";

const STATUS_LABEL: Record<TopicStatus, string> = { noidea: "No idea", shaky: "Shaky", know: "Know" };

export default function PracticeHome() {
  const [practice, , ready] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [only, setOnly] = useState<"all" | TopicStatus>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean> | null>(null);

  const today = todayIST();
  const nextDay = DAYS.find((d) => d.date >= today && d.topics.length > 0);
  const nextTopics = nextDay ? nextDay.topics.map((id) => TOPICS.find((t) => t.id === id)).filter(Boolean) : [];

  const stats = useMemo(() => {
    const m: Record<string, { n: number; c: number }> = {};
    for (const r of Object.values(practice)) {
      m[r.topic] ??= { n: 0, c: 0 };
      m[r.topic].n++;
      if (r.correct) m[r.topic].c++;
    }
    return m;
  }, [practice]);

  if (!ready) return <p className="muted">Loading…</p>;

  const searching = q.trim().length > 0 || only !== "all";
  const firstSubject = nextTopics[0]?.subject;
  const isOpen = (sid: string) => searching || (open ? !!open[sid] : sid === firstSubject || (!firstSubject && sid === Object.keys(SUBJECTS)[0]));
  const toggle = (sid: string) => setOpen((o) => ({ ...(o ?? { [firstSubject ?? Object.keys(SUBJECTS)[0]]: true }), [sid]: !isOpen(sid) }));

  const match = (name: string, status: TopicStatus) =>
    (only === "all" || status === only) && name.toLowerCase().includes(q.trim().toLowerCase());

  return (
    <>
      <h1>Practice</h1>

      {nextDay && nextTopics.length > 0 && (
        <section className="pr-next">
          <div>
            <b>{nextDay.date === today ? "On today's plan" : `Next on your plan, ${fmtDate(nextDay.date)}`}</b>
            <span className="muted small">{nextDay.title}</span>
          </div>
          <div className="row">
            {nextTopics.slice(0, 3).map((t) => (
              <Link key={t!.id} href={`/practice/${t!.id}`} className="btn primary">{t!.name.split("(")[0].trim()}</Link>
            ))}
          </div>
        </section>
      )}

      <div className="pr-bar">
        <input type="search" className="pr-search" placeholder="Find a topic" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a topic" />
        <div className="tabs" style={{ margin: 0 }}>
          {([["all", "All"], ["noidea", "No idea"], ["shaky", "Shaky"], ["know", "Know"]] as ["all" | TopicStatus, string][]).map(([k, l]) => (
            <button key={k} className={only === k ? "on" : ""} onClick={() => setOnly(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="pr-list">
        {Object.entries(SUBJECTS).map(([sid, sname]) => {
          const all = TOPICS.filter((t) => t.subject === sid);
          const ts = all.filter((t) => match(t.name, t.status));
          if (!ts.length) return null;
          const started = all.filter((t) => stats[t.id]?.n).length;
          const o = isOpen(sid);
          return (
            <section key={sid} className={`pr-sub ${o ? "open" : ""}`}>
              <button className="pr-head" onClick={() => toggle(sid)} aria-expanded={o}>
                <span className="chev" aria-hidden="true">›</span>
                <h2>{sname}</h2>
                <span className="muted small">{started}/{all.length} started</span>
                <span className="pr-dots" aria-hidden="true">
                  {all.map((t) => <i key={t.id} className={t.status} />)}
                </span>
              </button>
              {o && (
                <div className="pr-rows">
                  {ts.map((t) => {
                    const s = stats[t.id];
                    const n = BANK.filter((x) => x.topic === t.id).length;
                    return (
                      <Link key={t.id} href={`/practice/${t.id}`} className="pr-row">
                        <i className={`dot ${t.status}`} title={STATUS_LABEL[t.status]} />
                        <span className="nm">{t.name}</span>
                        <span className="muted small">{s ? `${s.c}/${s.n} right` : `${n}${hasGenerator(t.id) ? "+" : ""} q`}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {searching && !TOPICS.some((t) => match(t.name, t.status)) && <p className="muted">No topic matches. Clear the search or pick another filter.</p>}
      </div>
      <p className="small muted">Dot colour is your own rating: red is new to you, amber is shaky, green is solid. A plus after the count means more generated questions.</p>
    </>
  );
}
