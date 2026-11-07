"use client";
import { bankSize } from "@/lib/packs";
import Link from "next/link";
import { useMemo, useState } from "react";
import Rich from "@/components/Rich";
import { PackData } from "@/lib/packs";
import { Ev, Filters, M, NO_FILTER, Node, allTags, applyFilters, breakdown, fmtMs, fmtPct, metrics, rank, tagStats } from "@/lib/stats";
import { squarify } from "@/lib/treemap";
import { COLOR_LABEL, ColorBy, median, tileColor, valueLabel } from "./colors";
import { plain } from "./useStats";

type Size = "n" | "total";
type SortKey = "name" | "n" | "acc" | "skipRate" | "avgMs" | "coverage" | "trend";
const PERIODS: [number | null, string][] = [[null, "All time"], [30, "30 days"], [7, "7 days"]];

const trendText = (t: number | null) => (t === null ? "n/a" : t > 0.02 ? `▲ ${Math.round(t * 100)} pts` : t < -0.02 ? `▼ ${Math.round(-t * 100)} pts` : "● steady");
const when = (t: number | null) => (t === null ? "never" : new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }));

function Bar({ m }: { m: M }) {
  const n = m.n || 1;
  return (
    <span className="st-stack" title={`${m.right} right, ${m.wrong} wrong, ${m.skip} skipped`}>
      <i className="r" style={{ width: `${(m.right / n) * 100}%` }} /><i className="w" style={{ width: `${(m.wrong / n) * 100}%` }} /><i className="s" style={{ width: `${(m.skip / n) * 100}%` }} />
    </span>
  );
}

/** Weekly accuracy line for a set of events. */
function Spark({ evs }: { evs: Ev[] }) {
  const weeks = new Map<number, { r: number; a: number }>();
  for (const e of evs) { if (e.out === "skip") continue; const k = Math.floor(e.at / (7 * 86_400_000)); const v = weeks.get(k) ?? { r: 0, a: 0 }; v.a++; if (e.out === "right") v.r++; weeks.set(k, v); }
  const pts = [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v.r / v.a);
  if (pts.length < 2) return <p className="small muted">The weekly trend appears after two weeks of answers.</p>;
  const W = 220, H = 54;
  const xy = pts.map((p, i) => [(i / (pts.length - 1)) * (W - 8) + 4, H - 6 - p * (H - 12)]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="st-spark" role="img" aria-label="Accuracy by week">
      <polyline points={xy.map((p) => p.join(",")).join(" ")} />
      {xy.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.6" />)}
    </svg>
  );
}

export default function Explorer({ evs, pack, initialPath = [] }: { evs: Ev[]; pack: PackData; initialPath?: string[] }) {
  const [filters, setFilters] = useState<Filters>(NO_FILTER);
  const [path, setPath] = useState<string[]>(initialPath);       // [] = all subjects, [subject], [subject, topic]
  const [by, setBy] = useState<ColorBy>("acc");
  const [size, setSize] = useState<Size>("n");
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);     // a selected question
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "n", dir: -1 });

  const filtered = useMemo(() => applyFilters(evs, filters), [evs, filters]);
  const bd = useMemo(() => breakdown(filtered, pack), [filtered, pack]);
  const tags = useMemo(() => allTags(pack), [pack]);

  const level = path.length; // 0 subjects, 1 topics, 2 questions
  const nodes: Node[] = level === 0 ? bd.subjects : level === 1 ? bd.topics.filter((t) => t.parent === path[0]) : bd.questions.filter((q) => q.parent === path[1]);
  const cur: Node | null = level === 0 ? null : level === 1 ? bd.subjects.find((s) => s.id === path[0]) ?? null : bd.topics.find((t) => t.id === path[1]) ?? null;

  // tiles: sized by attempts (or by how many questions exist), with a floor so untouched items stay visible
  const raw = nodes.map((n) => (level === 2 ? Math.max(n.m.n, 0) : size === "n" ? n.m.n : n.m.total));
  const floor = Math.max(1, (raw.reduce((s, v) => s + v, 0) / Math.max(raw.length, 1)) * 0.22);
  const rects = useMemo(() => squarify(raw.map((v) => Math.max(v, floor))), [raw.join(","), floor]); // eslint-disable-line react-hooks/exhaustive-deps
  const med = median(nodes.map((n) => n.m.avgMs ?? 0));

  const focusNode = nodes.find((n) => n.id === (hover ?? picked)) ?? nodes.find((n) => n.id === picked) ?? cur ?? null;
  const focusEvs = useMemo(() => {
    if (!focusNode) return filtered;
    if (focusNode.kind === "subject") return filtered.filter((e) => e.subject === focusNode.id);
    if (focusNode.kind === "topic") return filtered.filter((e) => e.topic === focusNode.id);
    return filtered.filter((e) => e.q === focusNode.id);
  }, [focusNode, filtered]);
  const focusM = focusNode?.m ?? metrics(filtered, bankSize(pack));
  const focusTags = useMemo(() => tagStats(focusEvs, pack).slice(0, 8), [focusEvs, pack]);
  const kids = rank(nodes.filter((n) => n.kind !== "question"), 3);

  const open = (n: Node) => {
    if (n.kind === "subject") { setPath([n.id]); setPicked(null); }
    else if (n.kind === "topic") { setPath([n.parent!, n.id]); setPicked(null); }
    else setPicked((p) => (p === n.id ? null : n.id));
    setHover(null);
  };
  const crumb = (i: number) => { setPath(path.slice(0, i)); setPicked(null); setHover(null); };

  const rows = [...nodes].sort((a, b) => {
    const g = (n: Node) => (sort.k === "name" ? n.name.toLowerCase() : sort.k === "acc" ? n.m.acc ?? -1 : sort.k === "avgMs" ? n.m.avgMs ?? -1 : sort.k === "trend" ? n.m.trend ?? -9 : (n.m[sort.k] as number));
    const x = g(a), y = g(b);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  });
  const head = (k: SortKey, label: string) => <th><button className={`st-th ${sort.k === k ? "on" : ""}`} onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : -1 }))}>{label}{sort.k === k ? (sort.dir === -1 ? " ↓" : " ↑") : ""}</button></th>;

  const qNode = focusNode?.kind === "question" ? (focusNode as Node & { q?: import("@/lib/types").Question; tags: string[] }) : null;
  const anyFilter = filters.days !== null || filters.src !== "all" || filters.type !== "all" || filters.tag !== null;

  return (
    <div className="st-explore">
      <div className="st-filters">
        <div className="st-seg" role="group" aria-label="Period">{PERIODS.map(([d, l]) => <button key={l} className={filters.days === d ? "on" : ""} onClick={() => setFilters((f) => ({ ...f, days: d }))}>{l}</button>)}</div>
        <div className="st-seg" role="group" aria-label="Source">{([["all", "Everything"], ["practice", "Practice"], ["mock", "Mocks"]] as const).map(([k, l]) => <button key={k} className={filters.src === k ? "on" : ""} onClick={() => setFilters((f) => ({ ...f, src: k }))}>{l}</button>)}</div>
        <div className="st-seg" role="group" aria-label="Question type">{(["all", "mcq", "msq", "nat"] as const).map((k) => <button key={k} className={filters.type === k ? "on" : ""} onClick={() => setFilters((f) => ({ ...f, type: k }))}>{k === "all" ? "Any type" : k.toUpperCase()}</button>)}</div>
        {tags.length > 0 && (
          <select className="st-select" aria-label="Tag" value={filters.tag ?? ""} onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value || null }))}>
            <option value="">Any tag</option>{tags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </select>
        )}
        {anyFilter && <button className="btn soft" onClick={() => setFilters(NO_FILTER)}>Reset filters</button>}
        <span className="small muted right">{filtered.length} encounter{filtered.length === 1 ? "" : "s"}</span>
      </div>

      <div className="st-crumbs" aria-label="Where you are">
        <button onClick={() => crumb(0)} className={level === 0 ? "on" : ""}>All subjects</button>
        {path.map((id, i) => (
          <span key={id}><i>›</i><button onClick={() => crumb(i + 1)} className={i === path.length - 1 ? "on" : ""}>{i === 0 ? pack.subjects[id] ?? id : pack.topics.find((t) => t.id === id)?.name ?? id}</button></span>
        ))}
        <span className="small muted right">{level === 0 ? "Click a subject to open it" : level === 1 ? "Click a topic to see its questions" : "Click a question for its history"}</span>
      </div>

      <div className="st-grid">
        <div>
          <div className="st-ctl">
            <span className="small muted">Colour by</span>
            <div className="st-seg">{(Object.keys(COLOR_LABEL) as ColorBy[]).map((k) => <button key={k} className={by === k ? "on" : ""} onClick={() => setBy(k)}>{COLOR_LABEL[k]}</button>)}</div>
            {level < 2 && <><span className="small muted">Size by</span>
              <div className="st-seg"><button className={size === "n" ? "on" : ""} onClick={() => setSize("n")}>Your attempts</button><button className={size === "total" ? "on" : ""} onClick={() => setSize("total")}>Questions available</button></div></>}
          </div>

          {nodes.length === 0 ? <div className="st-empty">Nothing here yet. Practise a topic and it shows up.</div> : (
            <div className="st-map" role="list">
              {nodes.map((n, i) => {
                const r = rects[i], area = r.w * r.h;
                const sel = n.id === picked;
                return (
                  <button key={n.id} role="listitem" className={`st-tile ${sel ? "sel" : ""} ${hover === n.id ? "hov" : ""} ${n.m.n === 0 ? "empty" : ""}`}
                    style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`, ...tileColor(n.m, by, med) } as React.CSSProperties}
                    onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(n.id)} onBlur={() => setHover(null)} onClick={() => open(n)}
                    aria-label={`${n.kind === "question" ? plain(n.name, 60) : n.name}: ${valueLabel(n.m, by)} ${COLOR_LABEL[by].toLowerCase()}, ${n.m.n} encounters`}>
                    <span className="in">
                      {area > 60 && <b>{n.kind === "question" ? `Q${i + 1}` : n.name}</b>}
                      {area > 160 && n.kind === "question" && <em>{plain(n.name, 44)}</em>}
                      {area > 110 && <strong>{valueLabel(n.m, by)}</strong>}
                      {area > 420 && <small>{n.m.n} tries · {n.m.unique}/{n.m.total || "?"} seen</small>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="st-legend" aria-hidden="true">
            <span>{by === "coverage" ? "less seen" : by === "speed" ? "slow" : "weak"}</span><i className={`ramp ${by}`} /><span>{by === "coverage" ? "fully seen" : by === "speed" ? "fast" : by === "skip" ? "never skipped" : "strong"}</span><span className="gray">grey = no data yet</span>
          </div>
        </div>

        <aside className="st-detail panel" aria-live="polite">
          <div className="small muted">{focusNode ? (focusNode.kind === "question" ? "Question" : focusNode.kind === "topic" ? "Topic" : "Subject") : "All your data"}{hover ? " · hover preview" : ""}</div>
          <h3>{focusNode ? (focusNode.kind === "question" ? `Q${nodes.findIndex((n) => n.id === focusNode.id) + 1}` : focusNode.name) : "Everything"}
            {focusNode?.kind === "topic" && focusNode.status && <span className={`pill ${focusNode.status}`}>{focusNode.status === "noidea" ? "no idea" : focusNode.status}</span>}</h3>
          {qNode?.q && <div className="st-q"><Rich text={qNode.q.text} /></div>}
          {focusM.n === 0 ? <p className="muted small">Not attempted in this view yet.</p> : <>
            <Bar m={focusM} />
            <dl className="st-dl">
              <div><dt>Accuracy</dt><dd>{fmtPct(focusM.acc)}</dd></div>
              <div><dt>Encounters</dt><dd>{focusM.n}</dd></div>
              <div><dt>Right / wrong / skipped</dt><dd>{focusM.right} / {focusM.wrong} / {focusM.skip}</dd></div>
              <div><dt>Skip rate</dt><dd>{fmtPct(focusM.skipRate)}</dd></div>
              <div><dt>Average time</dt><dd>{fmtMs(focusM.avgMs)}</dd></div>
              {focusNode?.kind !== "question" && <div><dt>Coverage</dt><dd>{focusM.unique} of {focusM.total} questions</dd></div>}
              <div><dt>Last 2 weeks</dt><dd>{trendText(focusM.trend)}</dd></div>
              <div><dt>Last seen</dt><dd>{when(focusM.last)}</dd></div>
            </dl>
            <Spark evs={focusEvs} />
          </>}
          {focusNode && focusNode.kind !== "question" && (kids.best || kids.worst) && (
            <div className="st-bw">
              {kids.best && <button onClick={() => open(kids.best!)}><span className="small muted">Strongest {level === 0 ? "subject" : "topic"}</span><b>{kids.best.name}</b><em className="good">{fmtPct(kids.best.m.acc)}</em></button>}
              {kids.worst && <button onClick={() => open(kids.worst!)}><span className="small muted">Weakest {level === 0 ? "subject" : "topic"}</span><b>{kids.worst.name}</b><em className="bad">{fmtPct(kids.worst.m.acc)}</em></button>}
            </div>
          )}
          {focusTags.length > 0 && <>
            <div className="small muted" style={{ marginTop: 12 }}>Tags here (accuracy)</div>
            <div className="st-tags">{focusTags.map((t) => <button key={t.tag} className="tg" onClick={() => setFilters((f) => ({ ...f, tag: t.tag }))} title="Filter by this tag">#{t.tag} {fmtPct(t.m.acc)}</button>)}</div>
          </>}
          {qNode && (
            <div className="st-hist">
              <div className="small muted">History</div>
              {focusEvs.slice().reverse().slice(0, 12).map((e, i) => <div key={i} className={`h ${e.out}`}><span>{e.out === "right" ? "✓ Right" : e.out === "wrong" ? "✗ Wrong" : "– Skipped"}</span><span className="muted small">{e.src === "mock" ? "mock" : "practice"} · {when(e.at)}{e.ms ? ` · ${fmtMs(e.ms)}` : ""}</span></div>)}
            </div>
          )}
          {focusNode && focusNode.kind !== "subject" && <Link className="btn primary" style={{ marginTop: 12 }} href={`/practice/${focusNode.kind === "topic" ? focusNode.id : focusNode.parent}`}>Practise {focusNode.kind === "topic" ? "this topic" : "its topic"}</Link>}
        </aside>
      </div>

      <section className="panel st-table">
        <h3>{level === 0 ? "Subjects" : level === 1 ? "Topics" : "Questions"} compared</h3>
        <div className="st-scroll"><table className="t">
          <thead><tr>{head("name", level === 2 ? "Question" : "Name")}{head("n", "Tries")}{head("acc", "Accuracy")}<th>Right / wrong / skip</th>{head("skipRate", "Skips")}{head("avgMs", "Avg time")}{level < 2 && head("coverage", "Coverage")}{head("trend", "Trend")}</tr></thead>
          <tbody>{rows.map((n) => (
            <tr key={n.id} className="st-row" onClick={() => open(n)} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
              <td><b>{n.kind === "question" ? plain(n.name, 70) : n.name}</b></td><td>{n.m.n}</td>
              <td><span className="st-acc"><i style={{ width: `${(n.m.acc ?? 0) * 100}%` }} />{fmtPct(n.m.acc)}</span></td>
              <td><Bar m={n.m} /></td><td>{n.m.n ? fmtPct(n.m.skipRate) : "n/a"}</td><td>{fmtMs(n.m.avgMs)}</td>
              {level < 2 && <td>{Math.round(n.m.coverage * 100)}%</td>}<td>{trendText(n.m.trend)}</td>
            </tr>))}</tbody>
        </table></div>
      </section>
    </div>
  );
}
