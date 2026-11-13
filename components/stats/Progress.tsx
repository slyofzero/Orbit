"use client";
import QPreview from "@/components/QPreview";
import Link from "next/link";
import { useMemo } from "react";
import { PackData } from "@/lib/packs";
import { PlanData } from "@/lib/plan";
import { Ev, fmtPct } from "@/lib/stats";
import {
  examPace, GUESS_MS, MASTERY_HELP, MASTERY_LABEL, MASTERY_ORDER, adherenceSummary, byDifficulty, byHour, byMarks, byType, headline,
  linkProgress, linkTotals, masteryByTopic, planAdherence, questionDetails, revisionQueue, traps, weekly, DIFFICULTIES, Group,
} from "@/lib/statsMore";
import { fmtDate, todayIST } from "@/lib/plan";
import { plain } from "./useStats";

const sec = (x: number | null) => (x === null ? "n/a" : x < 90 ? `${Math.round(x)}s` : `${Math.floor(x / 60)}m ${Math.round(x % 60)}s`);
const mins = (s: number) => (s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);
const href = (id: string, topic: string, type: string) => (type === "code" ? `/practice/programming/${encodeURIComponent(id)}` : `/practice/${topic}`);

function MasteryBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  return (
    <span className={`sp-mbar`} role="img" aria-label={MASTERY_ORDER.map((m) => `${counts[m]} ${MASTERY_LABEL[m]}`).join(", ")}>
      {MASTERY_ORDER.map((m) => counts[m] > 0 && <i key={m} className={`m-${m}`} style={{ width: `${(counts[m] / (total || 1)) * 100}%` }} title={`${MASTERY_LABEL[m]}: ${counts[m]}`} />)}
    </span>
  );
}

function Cut({ title, rows, label }: { title: string; rows: Group[]; label?: (k: string) => string }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="muted small">Nothing yet.</p> : (
        <div className="st-scroll"><table className="t">
          <thead><tr><th></th><th>Tries</th><th>Accuracy</th><th>Skips</th><th>Avg time</th><th>Net marks</th></tr></thead>
          <tbody>{rows.map((g) => (
            <tr key={g.key}><td><b>{label ? label(g.key) : g.key}</b></td><td>{g.m.n}</td>
              <td><span className="st-acc"><i style={{ width: `${(g.m.acc ?? 0) * 100}%` }} />{fmtPct(g.m.acc)}</span></td>
              <td>{g.m.skip}</td><td>{sec(g.m.avgMs === null ? null : g.m.avgMs / 1000)}</td><td>{g.net > 0 ? "+" : ""}{g.net}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}

export default function Progress({ evs, pack, views, plan, done, links }: {
  evs: Ev[]; pack: PackData; views: { q: string; at: number }[]; plan: PlanData | null; done: Record<string, boolean>; links: Record<string, { q: string[]; mock?: string }>;
}) {
  const details = useMemo(() => questionDetails(pack, evs, views), [pack, evs, views]);
  const h = useMemo(() => headline(evs, views, details), [evs, views, details]);
  const topics = useMemo(() => masteryByTopic(pack, details), [pack, details]);
  const queue = useMemo(() => revisionQueue(details), [details]);
  const trapQs = useMemo(() => traps(details).slice(0, 8), [details]);
  const weeks = useMemo(() => weekly(evs).slice(-16), [evs]);
  const hours = useMemo(() => byHour(evs), [evs]);
  const adh = useMemo(() => (plan ? planAdherence(plan, done, links, evs, todayIST()) : []), [plan, done, links, evs]);
  const a = adherenceSummary(adh);
  const lp = useMemo(() => (plan ? linkProgress(plan, links, evs, todayIST()) : []), [plan, links, evs]);
  const lt = linkTotals(lp);
  const total = details.length;
  const maxWeek = Math.max(1, ...weeks.map((w) => w.n));
  const maxHour = Math.max(1, ...hours.map((x) => x.n));
  const pace = h.avgSecPerMark;

  if (!evs.length && !views.length) return <section className="panel"><p className="muted" style={{ margin: 0 }}>Answer a few questions in Practice and this page fills with your mastery levels, pace, revision list and trends.</p></section>;

  return (
    <div className="st-over">
      <div className="st-kpis">
        <div><b>{h.views}</b><span>question views</span></div>
        <div><b>{fmtPct(h.firstTryAcc)}</b><span>right on the first try ({h.firstTryN} questions)</span></div>
        <div><b>{fmtPct(h.recovery)}</b><span>of past mistakes later fixed ({h.recoveryN})</span></div>
        <div><b>{h.net}</b><span>net marks ({h.earned} earned, {h.lost} lost)</span></div>
        <div><b>{mins(h.timeSec)}</b><span>practice time</span></div>
        <div><b>{pace === null ? "n/a" : `${Math.round(pace)}s`}<small> / mark</small></b><span>{examPace(pack) === null ? "pace per mark" : `pace (your mock tests allow about ${examPace(pack)}s)`}</span></div>
        <div><b>{sec(h.avgSecRight)} <small>vs</small> {sec(h.avgSecWrong)}</b><span>time on right vs wrong answers</span></div>
        <div><b>{fmtPct(h.guessShare)}</b><span>wrong answers under {GUESS_MS / 1000}s (guesses)</span></div>
      </div>

      <section className="panel">
        <h3>How well you know the question bank</h3>
        <MasteryBar counts={h.mastery} total={total} />
        <div className="sp-legend">
          {MASTERY_ORDER.map((m) => <span key={m} title={MASTERY_HELP[m]}><i className={`m-${m}`} />{MASTERY_LABEL[m]} <b>{h.mastery[m]}</b></span>)}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>{h.due} question{h.due === 1 ? " is" : "s are"} due for another look. A wrong answer comes back after a day; right answers come back after 3, 7, 14 and then 30 days.</p>
      </section>

      <div className="st-two">
        <section className="panel">
          <h3>Revise today</h3>
          <p className="small muted" style={{ marginTop: -6 }}>Most overdue first.</p>
          {queue.length === 0 ? <p className="muted small">Nothing is due. Come back tomorrow, or open something new.</p> : queue.slice(0, 10).map((d) => (
            <Link key={d.id} href={href(d.id, d.topic, d.type)} className="st-qrow">
              <span className="t"><QPreview text={d.text} max={90} /><small className="muted"> {d.topicName}</small></span>
              <span className="tags" />
              <span className="r"><span className="muted small">{MASTERY_LABEL[d.mastery]}{d.daysOverdue > 0 ? `, ${d.daysOverdue}d late` : ""}</span></span>
            </Link>
          ))}
          {queue.length > 10 && <p className="small muted" style={{ marginBottom: 0 }}>+{queue.length - 10} more in the Excel export (Revision queue).</p>}
        </section>
        <section className="panel">
          <h3>Traps: the same wrong option again</h3>
          <p className="small muted" style={{ marginTop: -6 }}>Questions where one wrong choice keeps winning. That usually means one specific misunderstanding.</p>
          {trapQs.length === 0 ? <p className="muted small">No repeated wrong picks yet. This fills in after you get the same MCQ or MSQ wrong twice.</p> : trapQs.map((d) => (
            <Link key={d.id} href={href(d.id, d.topic, d.type)} className="st-qrow">
              <span className="t"><QPreview text={d.text} max={90} /><small className="muted"> {d.topicName}</small></span>
              <span className="tags" />
              <span className="r"><b>{d.trap}</b> <span className="muted small">{d.trapCount}×</span></span>
            </Link>
          ))}
        </section>
      </div>

      <section className="panel">
        <h3>Mastery by topic</h3>
        <div className="st-scroll"><table className="t sp-topics">
          <thead><tr><th>Topic</th><th style={{ width: "42%" }}>Levels</th><th>Mastered</th><th>Due</th></tr></thead>
          <tbody>{[...topics].sort((x, y) => x.masteredShare - y.masteredShare).map((t) => (
            <tr key={t.topic}><td><Link href={`/practice/${t.topic}`}>{t.name}</Link><small className="muted" style={{ display: "block" }}>{t.subject}, {t.total} question{t.total === 1 ? "" : "s"}</small></td>
              <td><MasteryBar counts={t.counts} total={t.total} /></td><td>{fmtPct(t.masteredShare)}</td><td>{t.due || ""}</td></tr>
          ))}</tbody>
        </table></div>
      </section>

      <div className="st-two">
        <Cut title="By difficulty" rows={byDifficulty(evs).filter((g) => DIFFICULTIES.includes(g.key))} label={(k) => (k === "none" ? "no difficulty" : k)} />
        <Cut title="By question type" rows={byType(evs)} label={(k) => k.toUpperCase()} />
        <Cut title="By marks" rows={byMarks(evs)} />
        <section className="panel">
          <h3>Plan adherence</h3>
          {!plan || a.days === 0 ? <p className="muted small">Upload a plan to compare what you planned with what you did.</p> : (
            <ul className="st-tips">
              <li>Question target reached on <b>{a.targetMet} of {a.targetDays}</b> days ({fmtPct(a.targetRate)}).</li>
              <li>Tasks ticked: <b>{fmtPct(a.taskRate)}</b>.</li>
              {a.linkedRate !== null && <li>Linked questions answered on their own day: <b>{fmtPct(a.linkedRate)}</b>.</li>}
            </ul>
          )}
        </section>
      </div>

      {lp.length > 0 && (
        <section className="panel">
          <h3>Linked questions by day</h3>
          <p className="small muted" style={{ marginTop: -6 }}>
            {lt.answered} of {lt.total} questions linked to your plan answered ({lt.right} right now, {lt.wrong} wrong now).
            {lt.pastLeft > 0 ? ` ${lt.pastLeft} on days already past are still open.` : " Nothing is left over from past days."}
          </p>
          <div className="st-scroll"><table className="t">
            <thead><tr><th>Day</th><th style={{ width: "34%" }}>Progress</th><th>Answered</th><th>Right</th><th>Open</th></tr></thead>
            <tbody>{lp.map((r) => (
              <tr key={r.date}>
                <td><Link href={`/day/${r.date}`}>{fmtDate(r.date)}</Link><small className="muted" style={{ display: "block" }}>{plain(r.title, 50)}{r.past ? "" : " (upcoming)"}</small></td>
                <td><span className="sp-mbar" role="img" aria-label={`${r.right} right, ${r.wrong} wrong, ${r.left} open`}>
                  <i className="m-mastered" style={{ width: `${(r.right / (r.total || 1)) * 100}%` }} /><i className="m-struggling" style={{ width: `${(r.wrong / (r.total || 1)) * 100}%` }} />
                </span></td>
                <td>{r.answered}/{r.total}</td><td>{r.right}</td><td>{r.left > 0 ? <b style={{ color: r.past ? "var(--bad, #c0392b)" : undefined }}>{r.left}</b> : ""}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      <div className="st-two">
        <section className="panel">
          <h3>Weekly trend</h3>
          <p className="small muted" style={{ marginTop: -6 }}>Bar height is answers that week; the number is accuracy.</p>
          <div className="sp-bars" role="img" aria-label="Answers per week">
            {weeks.map((w) => (
              <div key={w.start} title={`Week of ${w.start}: ${w.n} answers, ${fmtPct(w.acc)} right, ${w.minutes} min`}>
                <small>{w.acc === null ? "" : `${Math.round(w.acc * 100)}`}</small>
                <i style={{ height: `${Math.max(3, (w.n / maxWeek) * 100)}%` }} />
                <em>{w.start.slice(5)}</em>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h3>Time of day</h3>
          <p className="small muted" style={{ marginTop: -6 }}>Answers by hour (IST). Hover a bar for accuracy.</p>
          <div className="sp-bars hours" role="img" aria-label="Answers by hour of day">
            {hours.map((x) => (
              <div key={x.label} title={`${x.label}: ${x.n} answers, ${fmtPct(x.acc)} right`}>
                <i style={{ height: `${Math.max(x.n ? 4 : 0, (x.n / maxHour) * 100)}%` }} />
                <em>{Number(x.label.slice(0, 2)) % 3 === 0 ? x.label.slice(0, 2) : ""}</em>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
