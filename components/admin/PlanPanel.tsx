"use client";
import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";
import { parsePlan, planToJson, templateJson } from "@/lib/customPlan";
import { readKey, readPack, readPlan, writeKey } from "@/lib/adminData";
import { checkImportedLinks, Links } from "@/lib/links";
import { KEYS } from "@/lib/store";
import { PlanData } from "@/lib/plan";

// The plan is edited as JSON (the same format the Planner upload takes). It is checked before it is saved.
export default function PlanPanel({ profile }: { profile: string }) {
  const [plan, setPlan] = useState<PlanData | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [ask, setAsk] = useState(false);

  useEffect(() => { const p = readPlan(profile); setPlan(p); setText(p ? JSON.stringify(planToJson(p, readKey<Links>(profile, KEYS.links) ?? {}), null, 2) : ""); }, [profile]);
  if (plan === undefined) return <p className="muted">Loading…</p>;

  const apply = () => {
    let json: unknown;
    try { json = JSON.parse(text); } catch (e) { setErrors([`This is not valid JSON: ${(e as Error).message}`]); setWarnings([]); return; }
    const r = parsePlan(json);
    setErrors(r.errors); setWarnings(r.warnings);
    if (!r.plan) return;
    writeKey(profile, KEYS.plan, r.plan);
    writeKey(profile, KEYS.milestones, null); // the milestones restart from the plan's own
    // links travel with the plan, same as the Planner upload: keep the ones that match this profile's questions
    const pk = readPack(profile);
    const lc = r.links && pk ? checkImportedLinks(r.links, r.plan, pk) : null;
    const good: Links = lc?.good ?? {};
    writeKey(profile, KEYS.links, Object.keys(good).length ? good : null);
    setPlan(r.plan);
    setText(JSON.stringify(planToJson(r.plan, good), null, 2));
    toast(`Saved. The plan now has ${r.plan.days.length} days${Object.keys(good).length ? ` and ${Object.keys(good).length} day${Object.keys(good).length === 1 ? "" : "s"} of linked questions` : ""}.${lc && lc.broken ? ` ${lc.broken} link${lc.broken === 1 ? "" : "s"} in the text did not match this profile's questions and ${lc.broken === 1 ? "was" : "were"} dropped.` : ""} Ticked days are kept.`);
  };
  const remove = () => { writeKey(profile, KEYS.plan, null); writeKey(profile, KEYS.milestones, null); writeKey(profile, KEYS.done, null); setPlan(null); setText(""); setAsk(false); toast("Plan removed."); };

  return (
    <>
      {plan ? (
        <p className="muted"><b>{plan.name}</b>: {plan.days.length} days{plan.days.length ? `, ${plan.days[0].date} to ${plan.days[plan.days.length - 1].date}` : ""}, {Object.keys(plan.phaseNames).length} phases, {plan.milestones.length} milestones.</p>
      ) : <p className="muted">This profile has no plan. Paste one below, or start from the template.</p>}
      <textarea className="pi-text pk-json" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} placeholder="Plan JSON" />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={apply} disabled={!text.trim()}>Check and save plan</button>
        {!plan && <button className="btn soft" onClick={() => setText(templateJson(new Date().toISOString().slice(0, 10)))}>Start from the template</button>}
        {plan && (ask ? <>Remove this plan? <button className="btn primary" onClick={remove}>Yes, remove</button> <button className="btn soft" onClick={() => setAsk(false)}>No</button></> : <button className="btn soft" onClick={() => setAsk(true)}>Remove plan</button>)}
      </div>
      {errors.length > 0 && <div className="pi-err" role="alert"><b>🔴 Fix this first:</b><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
      {warnings.length > 0 && <ul className="pi-warn">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
    </>
  );
}
