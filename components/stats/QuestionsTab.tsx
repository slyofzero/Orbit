"use client";
import Link from "next/link";
import { ReactNode, useMemo, useState } from "react";
import { PackData } from "@/lib/packs";
import { Ev, Node, breakdown, fmtMs, fmtPct, tagStats } from "@/lib/stats";
import { plain } from "./useStats";

type QN = Node & { tags: string[]; mock?: string; q?: import("@/lib/types").Question };

function List({ title, hint, rows, right, empty, topicName }: { title: string; hint: string; topicName: (id?: string) => string; rows: QN[]; right: (q: QN) => ReactNode; empty: string }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <p className="small muted" style={{ marginTop: -6 }}>{hint}</p>
      {rows.length === 0 ? <p className="muted small">{empty}</p> : rows.map((q) => (
        <Link key={q.id} href={q.mock ? "/mocks" : `/practice/${q.parent}`} className="st-qrow">
          <span className="t">{plain(q.name, 100)}<small className="muted"> {topicName(q.parent)}</small></span>
          <span className="tags">{q.tags.slice(0, 3).map((t) => <i key={t} className="tg">#{t}</i>)}</span>
          <span className="r">{right(q)}</span>
        </Link>
      ))}
    </section>
  );
}

export default function QuestionsTab({ evs, pack }: { evs: Ev[]; pack: PackData }) {
  const bd = useMemo(() => breakdown(evs, pack), [evs, pack]);
  const tags = useMemo(() => tagStats(evs, pack), [evs, pack]);
  const [showNever, setShowNever] = useState(false);
  const qs = bd.questions as QN[];
  const seen = qs.filter((q) => q.m.n > 0);
  const never = qs.filter((q) => q.m.n === 0 && q.q);
  const top = (a: QN[], n = 8) => a.slice(0, n);

  const most = top([...seen].sort((a, b) => b.m.n - a.m.n));
  const least = top([...seen].sort((a, b) => a.m.n - b.m.n || (a.m.last ?? 0) - (b.m.last ?? 0)));
  const wrong = top([...seen].filter((q) => q.m.wrong > 0 && q.m.right === 0).sort((a, b) => b.m.wrong - a.m.wrong));
  const slow = top([...seen].filter((q) => q.m.avgMs !== null).sort((a, b) => b.m.avgMs! - a.m.avgMs!));
  const skipped = top([...seen].filter((q) => q.m.skip > 0).sort((a, b) => b.m.skip - a.m.skip));
  const topicName = (id?: string) => pack.topics.find((t) => t.id === id)?.name ?? "";

  return (
    <div className="st-qs">
      <div className="st-two">
        <List topicName={topicName} title="Most encountered" hint="The questions you meet again and again." rows={most} empty="Nothing answered yet." right={(q) => <><b>{q.m.n}×</b> <span className="muted small">{fmtPct(q.m.acc)} right</span></>} />
        <List topicName={topicName} title="Least encountered" hint="Seen only once or twice. Revisit them before you forget." rows={least} empty="Nothing answered yet." right={(q) => <><b>{q.m.n}×</b> <span className="muted small">{topicName(q.parent)}</span></>} />
        <List topicName={topicName} title="Always wrong" hint="Wrong every time you tried. These hide the real gaps." rows={wrong} empty="No question has beaten you every time. Nice." right={(q) => <><b>{q.m.wrong}</b> <span className="muted small">wrong, 0 right</span></>} />
        <List topicName={topicName} title="Slowest" hint="Practice questions that take you longest." rows={slow} empty="Times appear after you answer in Practice." right={(q) => <><b>{fmtMs(q.m.avgMs)}</b> <span className="muted small">avg</span></>} />
        <List topicName={topicName} title="Most skipped" hint="Questions you skip when you meet them." rows={skipped} empty="You have not skipped anything." right={(q) => <><b>{q.m.skip}</b> <span className="muted small">skips</span></>} />
        <section className="panel">
          <h3>Never seen</h3>
          <p className="small muted" style={{ marginTop: -6 }}>{never.length} of {qs.filter((q) => q.q).length} questions in your pack (practice and mock tests) have never been shown to you.</p>
          {never.length > 0 && <button className="btn soft" onClick={() => setShowNever((v) => !v)}>{showNever ? "Hide list" : "Show list"}</button>}
          {showNever && never.slice(0, 40).map((q) => <Link key={q.id} href={q.mock ? "/mocks" : `/practice/${q.parent}`} className="st-qrow"><span className="t">{plain(q.name, 100)}</span><span className="tags" /><span className="r muted small">{q.mock ? `${q.mock} · ` : ""}{topicName(q.parent)}</span></Link>)}
        </section>
      </div>

      {tags.length > 0 && (
        <section className="panel">
          <h3>By tag</h3>
          <p className="small muted" style={{ marginTop: -6 }}>Your optional tags (skill, difficulty, idea…) and how you do on each.</p>
          <div className="st-scroll"><table className="t">
            <thead><tr><th>Tag</th><th>Tries</th><th>Accuracy</th><th>Skips</th><th>Avg time</th><th>Seen</th></tr></thead>
            <tbody>{tags.slice(0, 30).map((t) => (
              <tr key={t.tag}><td><span className="tg">#{t.tag}</span></td><td>{t.m.n}</td>
                <td><span className="st-acc"><i style={{ width: `${(t.m.acc ?? 0) * 100}%` }} />{fmtPct(t.m.acc)}</span></td>
                <td>{fmtPct(t.m.skipRate)}</td><td>{fmtMs(t.m.avgMs)}</td><td>{t.m.unique}/{t.m.total}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}
