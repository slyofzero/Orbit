"use client";
import { CSSProperties, useState } from "react";
import { Milestone, daysBetween, fmtLong } from "@/lib/plan";

const PALETTE = ["var(--accent)", "var(--red)", "var(--green)", "var(--amber)", "var(--blue)"];
type Api = { add: (m: Omit<Milestone, "id" | "short">) => void; update: (id: string, p: Partial<Milestone>) => void; remove: (id: string) => void };

export default function Milestones({ today, milestones, api, onRemoved }: { today: string; milestones: Milestone[]; api: Api; onRemoved: (removed: Milestone) => void }) {
  const [form, setForm] = useState<{ id?: string; name: string; date: string; note: string } | null>(null);
  const nextId = milestones.find((x) => daysBetween(today, x.date) >= 0)?.id;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !form.name.trim() || !form.date) return;
    const v = { name: form.name.trim(), date: form.date, note: form.note.trim() };
    form.id ? api.update(form.id, v) : api.add(v);
    setForm(null);
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Milestones</h2>
        {!form && <button className="btn soft" onClick={() => setForm({ name: "", date: today, note: "" })}>+ Add</button>}
      </div>

      {form && (
        <form className="ms-form" onSubmit={submit}>
          <label>Name<input type="text" autoFocus required maxLength={40} value={form.name} placeholder="e.g. Viva, Mock series" onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Date<input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label>Note (optional)<input type="text" maxLength={80} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          <div className="row">
            <button className="btn primary" type="submit">{form.id ? "Save changes" : "Add milestone"}</button>
            <button className="btn soft" type="button" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      {milestones.length === 0 && !form && <div className="ms-empty">No milestones yet. Add an exam or deadline and the countdown starts.</div>}
      <div className="ms-list">
        {milestones.map((m, i) => {
          const n = daysBetween(today, m.date);
          return (
            <div key={m.id} className={`ms-row ${m.id === nextId ? "next" : ""} ${n < 0 ? "past" : ""}`} style={{ "--c": PALETTE[i % PALETTE.length] } as CSSProperties}>
              <span className="name">{m.name}</span>
              <span className="days">{n < 0 ? "done" : n}{n >= 0 && <small>{n === 1 ? "day" : "days"}</small>}</span>
              <span className="acts">
                <button className="mini" aria-label={`Edit ${m.name}`} title="Edit" onClick={() => setForm({ id: m.id, name: m.name, date: m.date, note: m.note ?? "" })}>✎</button>
                <button className="mini del" aria-label={`Remove ${m.name}`} title="Remove" onClick={() => { api.remove(m.id); onRemoved(m); }}>✕</button>
              </span>
              <span className="small muted">{fmtLong(m.date)}{m.note ? `. ${m.note}` : ""}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
