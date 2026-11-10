"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { hasGenerator } from "@/lib/bank";
import PackImport from "@/components/PackImport";
import TagFilter from "@/components/TagFilter";
import { makeMatcher } from "@/lib/questionFilter";
import PracticeTabs from "@/components/PracticeTabs";
import { fmtDate, todayIST } from "@/lib/plan";
import { KEYS, usePack, usePersisted, usePlan } from "@/lib/store";
import { PracticeRec, TopicStatus } from "@/lib/types";
import PageLoading from "@/components/PageLoading";

const STATUS_LABEL: Record<TopicStatus, string> = { noidea: "No idea", shaky: "Shaky", know: "Know" };

export default function PracticeHome() {
  const { days: DAYS, ready: planReady } = usePlan();
  const { pack, custom: hasPack, ready: packReady } = usePack();
  const SUBJECTS = pack.subjects;
  const TOPICS = pack.topics;
  const [managing, setManaging] = useState(false);
  const [done, setDone] = useState("");
  const [practice, , ready] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [only, setOnly] = useState<"all" | TopicStatus>("all");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
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

  if (!ready || !planReady || !packReady) return <PageLoading />;

  const searching = q.trim().length > 0 || only !== "all" || picked.length > 0;
  const passes = makeMatcher(pack, picked);
  const tagged = (id: string) => pack.questions.filter((x) => x.topic === id && x.type !== "code" && passes(x)).length;
  const practiceQs = pack.questions.filter((x) => x.type !== "code");
  const firstSubject = nextTopics[0]?.subject;
  const isOpen = (sid: string) => searching || (open ? !!open[sid] : sid === firstSubject || (!firstSubject && sid === Object.keys(SUBJECTS)[0]));
  const toggle = (sid: string) => setOpen((o) => ({ ...(o ?? { [firstSubject ?? Object.keys(SUBJECTS)[0]]: true }), [sid]: !isOpen(sid) }));

  const match = (name: string, status: TopicStatus) =>
    (only === "all" || status === only) && name.toLowerCase().includes(q.trim().toLowerCase());
  const matchTopic = (t: { id: string; name: string; status: TopicStatus }) => match(t.name, t.status) && (picked.length === 0 || tagged(t.id) > 0);

  return (
    <>
      <div className="row" style={{ alignItems: "center", marginBottom: 18 }}>
        <h1>Practice</h1>
        <PracticeTabs active="topics" />
        {hasPack && <button className="btn invert right" onClick={() => setManaging((m) => !m)}>{managing ? "Back to topics" : "Manage pack"}</button>}
      </div>

      {!hasPack && (
        <>
          <div className="panel" style={{ marginBottom: 18 }}>
            <h2 style={{ marginTop: 0 }}>No questions yet</h2>
            <p className="muted" style={{ margin: 0 }}>Practice and Mocks are powered by a question pack: your topics, your questions and your mock-test recipes. Upload one below to get started.</p>
          </div>
          <PackImport onDone={(m) => { setDone(m); window.scrollTo({ top: 0 }); }} />
        </>
      )}
      {hasPack && managing && <PackImport onDone={(m) => { setDone(m); setManaging(false); window.scrollTo({ top: 0 }); }} />}
      {hasPack && !managing && <>
      {done && <div className="pi-ok" role="status" style={{ marginBottom: 14 }}><span>✓ {done}</span><button className="btn soft" style={{ justifySelf: "start" }} onClick={() => setDone("")}>Dismiss</button></div>}

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
        <TagFilter pack={pack} qs={practiceQs} picked={picked} onChange={setPicked} />
      </div>

      {picked.length > 0 && !TOPICS.some(matchTopic) && <p className="muted">No topic has questions that match this filter.</p>}

      <div className="pr-list">
        {Object.entries(SUBJECTS).map(([sid, sname]) => {
          const all = TOPICS.filter((t) => t.subject === sid);
          const ts = all.filter(matchTopic);
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
                    const n = pack.questions.filter((x) => x.topic === t.id && x.type !== "code").length;
                    return (
                      <Link key={t.id} href={`/practice/${t.id}`} className="pr-row">
                        <i className={`dot ${t.status}`} title={STATUS_LABEL[t.status]} />
                        <span className="nm">{t.name}</span>
                        {picked.length > 0 || !s ? (
                          <span className="muted small">{picked.length > 0 ? `${tagged(t.id)} matching q` : `${n}${hasGenerator(pack, t.id) ? "+" : ""} q`}</span>
                        ) : (
                          <span className="pr-prog" title={`${s.n} answered of ${n}: ${s.c} right, ${s.n - s.c} wrong`}>
                            <span className="pr-prog-bar" aria-hidden="true">
                              <i className="ok" style={{ width: `${Math.min(100, (s.c / Math.max(1, n)) * 100)}%` }} />
                              <i className="bad" style={{ width: `${Math.min(100 - Math.min(100, (s.c / Math.max(1, n)) * 100), ((s.n - s.c) / Math.max(1, n)) * 100)}%` }} />
                            </span>
                            <span className="small"><b>{s.n}</b><span className="muted"> / {n}{hasGenerator(pack, t.id) ? "+" : ""} q</span></span>
                          </span>
                        )}
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
      </>}
    </>
  );
}
