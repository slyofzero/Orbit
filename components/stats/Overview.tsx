"use client";
import { useMemo } from "react";
import { PackData } from "@/lib/packs";
import { Attempt } from "@/lib/types";
import { Ev, activity, breakdown, fmtMs, fmtPct, insights, metrics, mockScores, rank } from "@/lib/stats";

const WEEKS = 18;

function Heatmap({ per, today }: { per: Map<string, { n: number; right: number }>; today: string }) {
  const end = Date.parse(today + "T00:00:00Z");
  const dow = new Date(end).getUTCDay();               // 0 = Sunday
  const start = end - ((WEEKS - 1) * 7 + dow) * 86_400_000;
  const max = Math.max(1, ...[...per.values()].map((v) => v.n));
  const cols = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const t = start + (w * 7 + d) * 86_400_000;
    const key = new Date(t).toISOString().slice(0, 10);
    return { key, v: t > end ? null : per.get(key) ?? { n: 0, right: 0 } };
  }));
  return (
    <div className="st-heat" role="img" aria-label="Activity over the last months">
      {cols.map((c, i) => (
        <div key={i}>{c.map(({ key, v }) => (
          <i key={key} className={v === null ? "off" : v.n === 0 ? "l0" : v.n <= max * 0.25 ? "l1" : v.n <= max * 0.5 ? "l2" : v.n <= max * 0.75 ? "l3" : "l4"}
            title={v ? `${key}: ${v.n} question${v.n === 1 ? "" : "s"}${v.n ? `, ${Math.round((v.right / v.n) * 100)}% right` : ""}` : ""} />
        ))}</div>
      ))}
    </div>
  );
}

function MockTrend({ attempts }: { attempts: Attempt[] }) {
  const m = mockScores(attempts);
  if (m.length < 2) return <p className="small muted">Finish two mocks to see your score trend.</p>;
  const W = 420, H = 130, pad = 26;
  const xy = m.map((x, i) => [pad + (i / (m.length - 1)) * (W - pad * 2), H - 22 - x.pct * (H - 40)]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="st-trend" role="img" aria-label="Mock score trend">
      {[0, 0.5, 1].map((g) => <g key={g}><line x1={pad} x2={W - pad} y1={H - 22 - g * (H - 40)} y2={H - 22 - g * (H - 40)} /><text x="2" y={H - 18 - g * (H - 40)}>{g * 100}%</text></g>)}
      <polyline points={xy.map((p) => p.join(",")).join(" ")} />
      {xy.map((p, i) => <g key={i}><circle cx={p[0]} cy={p[1]} r="4"><title>{`${m[i].title}: ${Math.round(m[i].pct * 100)}% (${m[i].got.toFixed(1)}/${m[i].max})`}</title></circle></g>)}
    </svg>
  );
}

export default function Overview({ evs, pack, attempts, onExplore }: { evs: Ev[]; pack: PackData; attempts: Attempt[]; onExplore: (path: string[]) => void }) {
  const bd = useMemo(() => breakdown(evs, pack), [evs, pack]);
  const all = useMemo(() => metrics(evs, pack.questions.length), [evs, pack]);
  const act = useMemo(() => activity(evs), [evs]);
  const subs = useMemo(() => rank(bd.subjects, 5), [bd]);
  const tips = useMemo(() => insights(evs, bd), [evs, bd]);
  const mocks = mockScores(attempts);

  return (
    <div className="st-over">
      <div className="st-kpis">
        <div><b>{all.n}</b><span>encounters</span></div>
        <div><b>{fmtPct(all.acc)}</b><span>accuracy</span></div>
        <div><b>{all.unique}<small> / {pack.questions.length}</small></b><span>questions seen</span></div>
        <div><b>{act.current}<small> day{act.current === 1 ? "" : "s"}</small></b><span>current streak (best {act.best})</span></div>
        <div><b>{fmtMs(all.avgMs)}</b><span>avg time per answer</span></div>
        <div><b>{mocks.length ? fmtPct(mocks[mocks.length - 1].pct) : "n/a"}</b><span>latest mock</span></div>
      </div>

      <div className="st-two">
        <button className="panel st-bw-card good" disabled={!subs.best} onClick={() => subs.best && onExplore([subs.best.id])}>
          <span className="small muted">Strongest subject</span><h3>{subs.best?.name ?? "Not enough data yet"}</h3>
          <p>{subs.best ? `${fmtPct(subs.best.m.acc)} right over ${subs.best.m.answered} answers. Click to explore.` : "A subject needs 5 answered questions to be ranked."}</p>
        </button>
        <button className="panel st-bw-card bad" disabled={!subs.worst} onClick={() => subs.worst && onExplore([subs.worst.id])}>
          <span className="small muted">Weakest subject</span><h3>{subs.worst?.name ?? "Not enough data yet"}</h3>
          <p>{subs.worst ? `${fmtPct(subs.worst.m.acc)} right over ${subs.worst.m.answered} answers. Click to explore.` : "Rankings need at least two subjects with 5 answers each."}</p>
        </button>
      </div>

      <section className="panel">
        <h3>What the numbers say</h3>
        <ul className="st-tips">{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </section>

      <div className="st-two">
        <section className="panel">
          <h3>Subjects at a glance</h3>
          {bd.subjects.length === 0 && <p className="muted small">No subjects yet.</p>}
          {bd.subjects.map((s) => (
            <button key={s.id} className="st-srow" onClick={() => onExplore([s.id])}>
              <span className="name">{s.name}</span>
              <span className="st-stack" title={`${s.m.right} right, ${s.m.wrong} wrong, ${s.m.skip} skipped`}>
                <i className="r" style={{ width: `${(s.m.right / (s.m.n || 1)) * 100}%` }} /><i className="w" style={{ width: `${(s.m.wrong / (s.m.n || 1)) * 100}%` }} /><i className="s" style={{ width: `${(s.m.skip / (s.m.n || 1)) * 100}%` }} />
              </span>
              <span className="val">{s.m.n ? fmtPct(s.m.acc) : "no data"}</span>
            </button>
          ))}
          <p className="small muted" style={{ marginBottom: 0 }}>Bars show right (green), wrong (red) and skipped (grey). Click a subject to drill into its topics.</p>
        </section>
        <section className="panel">
          <h3>Mock scores</h3>
          <MockTrend attempts={attempts} />
          <h3 style={{ marginTop: 18 }}>Daily activity</h3>
          <Heatmap per={act.per} today={act.today} />
          <p className="small muted" style={{ marginBottom: 0 }}>{act.activeDays} active day{act.activeDays === 1 ? "" : "s"}. Darker squares are busier days.</p>
        </section>
      </div>
    </div>
  );
}
