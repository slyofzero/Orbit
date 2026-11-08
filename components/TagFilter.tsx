"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PackData } from "@/lib/packs";
import { facets, Facet, Group, GROUP_LABEL } from "@/lib/questionFilter";
import type { Question } from "@/lib/types";

const STEP = 20;
const ORDER: Group[] = ["difficulty", "subject", "topic", "tag"];
const FRESH: Record<Group, number> = { subject: STEP, topic: STEP, difficulty: STEP, tag: STEP };

/** A "Filter" button with a popover: choices grouped as Subject, Topic and Misc (the other tags), searchable by name. Put it at the end of a toolbar row. */
export default function TagFilter({ pack, qs, picked, onChange, groups = ORDER }: {
  pack: PackData; qs: Question[]; picked: string[]; onChange: (keys: string[]) => void; groups?: Group[];
}) {
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState("");
  const [shownN, setShownN] = useState<Record<Group, number>>(FRESH);
  const box = useRef<HTMLDivElement>(null);
  const all = useMemo(() => facets(pack, qs), [pack, qs]);
  useEffect(() => {
    if (!open) { setShownN(FRESH); setFind(""); return; }
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  const shown = groups.filter((g) => all[g].length > 0);
  if (shown.length === 0 && picked.length === 0) return null;

  const n = find.trim().toLowerCase();
  const byKey = new Map<string, Facet>();
  for (const g of ORDER) for (const f of all[g]) byKey.set(f.key, f);
  const toggle = (k: string) => onChange(picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k]);
  const total = shown.reduce((s, g) => s + all[g].length, 0);

  return (
    <div className="tf-wrap" ref={box}>
      <button className={`btn soft tf-btn ${picked.length ? "on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog">
        <svg className="tf-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" /></svg>
        Filter{picked.length > 0 && <span className="tf-badge">{picked.length}</span>}
      </button>
      {open && (
        <div className="tf-pop" role="dialog" aria-label="Filter questions">
          <input autoFocus type="search" className="tf-find" placeholder={`Find a ${shown.map((g) => GROUP_LABEL[g].toLowerCase()).join(", ")} (${total} choices)`} value={find} onChange={(e) => { setFind(e.target.value); setShownN(FRESH); }} aria-label="Find a filter choice" />
          {picked.length > 0 && (
            <div className="tf-sel">
              {picked.map((k) => { const f = byKey.get(k); return <button key={k} className="tf-chip on" onClick={() => toggle(k)} title="Remove">{f?.label ?? k.slice(k.indexOf(":") + 1)} <small>{f?.count ?? 0}</small> ✕</button>; })}
              <button className="tf-clear" onClick={() => onChange([])}>Clear all</button>
            </div>
          )}
          <div className="tf-groups">
            {shown.map((g) => {
              const m = all[g].filter((f) => !picked.includes(f.key) && (!n || f.label.toLowerCase().includes(n)));
              if (m.length === 0) return null;
              return (
                <section key={g} className="tf-group">
                  <h4>{GROUP_LABEL[g]} <small>{m.length}</small></h4>
                  <div className="tf-list">
                    {m.slice(0, shownN[g]).map((f) => <button key={f.key} className="tf-chip" onClick={() => toggle(f.key)}>{f.label} <small>{f.count}</small></button>)}
                    {m.length > shownN[g] && (
                      <button className="tf-chip tf-more" onClick={() => setShownN((x) => ({ ...x, [g]: x[g] + STEP }))} title={`Show ${Math.min(STEP, m.length - shownN[g])} more`} aria-label={`Show ${Math.min(STEP, m.length - shownN[g])} more ${GROUP_LABEL[g]} choices`}>… <small>{m.length - shownN[g]} more</small></button>
                    )}
                  </div>
                </section>
              );
            })}
            {n && shown.every((g) => all[g].every((f) => picked.includes(f.key) || !f.label.toLowerCase().includes(n))) && <span className="small muted">Nothing matches “{find}”.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
