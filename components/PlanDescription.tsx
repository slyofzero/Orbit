"use client";
import { useEffect, useState } from "react";
import { PLAN_DESCRIPTION_MAX } from "@/lib/plan";
import { usePlan } from "@/lib/store";
import { toast } from "@/lib/toast";

// Edit the plan's description: what the plan is for, in your own words. It is added to every AI prompt that carries your plan.
export default function PlanDescription() {
  const { plan, custom, update } = usePlan();
  const saved = plan.description ?? "";
  const [text, setText] = useState(saved);
  useEffect(() => { setText(saved); }, [saved]);
  if (!custom) return null;
  const changed = text.trim() !== saved;
  const save = () => { update({ ...plan, description: text.trim().slice(0, PLAN_DESCRIPTION_MAX) || undefined }); toast("Description saved"); };
  return (
    <div style={{ marginTop: 14 }}>
      <label className="small" htmlFor="plan-desc"><b>Description</b> <span className="muted">(optional): the goal, the exam, how you study, what to stress. It is added to every AI prompt that includes your plan.</span></label>
      <textarea id="plan-desc" className="pi-text" rows={3} maxLength={PLAN_DESCRIPTION_MAX} value={text} onChange={(e) => { setText(e.target.value); }}
        placeholder="Example: Preparing for my final-year data science exam in February. Strong in maths, weak in databases. I study best in the evening." style={{ marginTop: 6 }} />
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn soft" onClick={save} disabled={!changed}>Save description</button>
        <span className="small muted">{text.length}/{PLAN_DESCRIPTION_MAX}</span>
      </div>
    </div>
  );
}
