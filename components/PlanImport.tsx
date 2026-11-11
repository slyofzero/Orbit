"use client";
import { useMemo, useRef, useState } from "react";
import { aiPrompt, aiUpdatePrompt, mergeDays, parsePlan, planToJson, templateJson } from "@/lib/customPlan";
import { downloadJson, fileSafe } from "@/lib/download";
import PlanDescription from "./PlanDescription";
import ExportFirstModal from "./ExportFirstModal";
import { fmtDate, todayIST, addDays } from "@/lib/plan";
import { usePack, usePlan } from "@/lib/store";
import { checkImportedLinks, Links } from "@/lib/links";
import { KEYS, usePersisted } from "@/lib/store";
import { toast } from "@/lib/toast";

const nextMonday = () => { const t = todayIST(); return addDays(t, ((8 - new Date(t).getUTCDay()) % 7) || 7); };
const save = (name: string, text: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.click();
};

// Where you swap the built-in plan for your own: a JSON file you upload, or text you paste.
export default function PlanImport({ onDone, editOnly = false }: { onDone: () => void; editOnly?: boolean }) {
  const { plan, custom, install, update, remove } = usePlan();
  const { pack } = usePack();
  const [curLinks, setCurLinks] = usePersisted<Links>(KEYS.links, {});
  const [, setDone] = usePersisted<Record<string, boolean>>(KEYS.done, {});
  const [modeState, setMode] = useState<"all" | "dates">("all");
  const mode = editOnly ? "dates" : modeState; // the Edit plan screen only ever updates the dates in the file
  const [linkChoice, setLinkChoice] = useState<"working" | "none">("working");
  const [text, setText] = useState("");
  const [keep, setKeep] = useState(false);
  const [ask, setAsk] = useState<null | "replace" | "remove">(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const start = nextMonday();

  const result = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return parsePlan(JSON.parse(text));
    } catch (e) {
      const m = (e as Error).message;
      return { plan: null, errors: [`This is not valid JSON: ${m}${/escape/i.test(m) ? ". If you wrote LaTeX, every backslash must be doubled, like \"$\\\\frac{1}{2}$\"." : ""}`], warnings: [] };
    }
  }, [text]);
  const p = result?.plan ?? null;

  const rawLinks = result?.links ?? [];
  const lc = useMemo(() => (p && rawLinks.length ? checkImportedLinks(rawLinks, p, pack) : null), [p, rawLinks, pack]); // eslint-disable-line react-hooks/exhaustive-deps
  const importedLinks: Links | undefined = lc?.good && (lc.broken === 0 || linkChoice === "working") ? lc.good : undefined;

  const useIt = () => { if (!p) return; install(p, keep, importedLinks); setText(""); setAsk(null); toast(`"${p.name}" is now your plan${importedLinks ? ` with ${Object.keys(importedLinks).length} day${Object.keys(importedLinks).length === 1 ? "" : "s"} of linked questions` : ""}.`); onDone(); };

  // only the dates in the file: replace or add those days, leave everything else as it is
  const merged = useMemo(() => (p && custom && mode === "dates" ? mergeDays(plan, p) : null), [p, custom, mode, plan]);
  const useDates = () => {
    if (!p || !merged) return;
    update(merged.plan);
    setDone((d) => {
      const n = { ...d };
      for (const [date, moves] of Object.entries(merged.tickMoves)) {
        const was = Object.keys(d).filter((k) => k.startsWith(`${date}:`));
        was.forEach((k) => delete n[k]);
        moves.forEach((from, i) => { if (from !== null && d[`${date}:${from}`]) n[`${date}:${i}`] = true; });
      }
      return n;
    });
    if (importedLinks) setCurLinks((l) => { const n = { ...l }; for (const [date, v] of Object.entries(importedLinks)) if (merged.updated.includes(date) || merged.added.includes(date)) n[date] = v; return n; });
    setText(""); toast(`Updated ${merged.updated.length} day${merged.updated.length === 1 ? "" : "s"} and added ${merged.added.length}. Every other day, your milestones and your ticks on other days were left alone.`);
    onDone();
  };

  const copy = async (what: string, value: string) => {
    try { await navigator.clipboard.writeText(value); toast(`${what} copied.`); } catch { toast("Copy was blocked by the browser. Use Download instead."); }
  };

  return (
    <div className="pi">
      {!editOnly && (<>
      <section className="panel pi-now">
        <div className="small muted">Your current plan</div>
        <h2 style={{ margin: "2px 0 4px" }}>{custom ? plan.name : "None loaded"}</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {custom ? `${plan.days.length} days · ${fmtDate(plan.days[0].date)} to ${fmtDate(plan.days[plan.days.length - 1].date)} · ${plan.milestones.length} milestone${plan.milestones.length === 1 ? "" : "s"}` : "Today, the calendar and the planner stay empty until you upload a plan."}
        </p>
        {custom && <PlanDescription />}
        {custom && (
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn soft" onClick={() => setAsk("remove")}>Remove this plan</button>
            <button className="btn soft" onClick={() => downloadJson(`${fileSafe(plan.name)}.json`, planToJson(plan, curLinks))}>Export this plan</button>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>1. Get a plan file</h2>
        <p className="muted small">A plan is one JSON file: the days, what to do on each, and your milestones. Write it yourself from the template, or let an AI write it for you.</p>
        <div className="row">
          <button className="btn soft" onClick={() => save("my-plan-template.json", templateJson(start))}>Download template</button>
          <button className="btn soft" onClick={() => copy("Template", templateJson(start))}>Copy template</button>
          <button className="btn primary" onClick={() => copy("AI prompt", aiPrompt(start))}>Copy AI prompt</button>
          {custom && <button className="btn soft" onClick={() => copy("AI prompt for selected dates", aiUpdatePrompt(plan))}>Copy AI prompt for selected dates</button>}
        </div>
        <p className="small muted" style={{ margin: "14px 0 0" }}>Copy AI prompt: paste it into any AI chat, fill in your goal and dates, and paste the JSON it gives back in step 2.{custom ? " To change only a few dates, use Copy AI prompt for selected dates, then choose \"Update only the dates in this file\" in step 2." : ""}</p>
      </section>

      </>)}

      <section className="panel">
        {editOnly ? (
          <>
            <h2 style={{ marginTop: 0 }}>Edit via JSON upload</h2>
            <p className="muted small">Change only some dates by uploading or pasting a JSON file. Days in the file replace the same dates in your plan, new dates are added, and every other day, your milestones and your ticks stay as they are.</p>
            <div className="row">
              <button className="btn primary" onClick={() => copy("AI prompt for selected dates", aiUpdatePrompt(plan))}>Copy AI prompt for selected dates</button>
              <button className="btn soft" onClick={() => downloadJson(`${fileSafe(plan.name)}.json`, planToJson(plan, curLinks))}>Export this plan</button>
            </div>
          </>
        ) : <h2 style={{ marginTop: 0 }}>2. Upload or paste it</h2>}
        <div className="row">
          <button className="btn soft" onClick={() => fileRef.current?.click()}>Upload JSON file</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setText(await f.text()); } e.target.value = ""; }} />
          {text && <button className="btn soft" onClick={() => setText("")}>Clear</button>}
        </div>
        <textarea className="pi-text" spellCheck={false} placeholder='…or paste the JSON here, e.g. { "name": "My plan", "days": [ … ] }' value={text} onChange={(e) => setText(e.target.value)} />

        {result && result.errors.length > 0 && (
          <div className="pi-err" role="alert">
            <b>🔴 Fix this first:</b>
            <ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}
        {result && result.warnings.length > 0 && <ul className="pi-warn">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}

        {p && (
          <div className="pi-ok">
            <b>✓ Looks good: {p.name}</b>
            <p className="small" style={{ margin: "4px 0" }}>{p.days.length} days from {fmtDate(p.days[0].date)} to {fmtDate(p.days[p.days.length - 1].date)} · {Object.keys(p.phaseNames).length} phase{Object.keys(p.phaseNames).length === 1 ? "" : "s"} · {p.days.reduce((s, d) => s + d.hours, 0)} planned hours</p>
            {p.milestones.length > 0 && <p className="small" style={{ margin: "4px 0" }}>Milestones: {p.milestones.map((m) => `${m.name} (${fmtDate(m.date)})`).join(", ")}</p>}
            {lc && (
              <div className="pi-links">
                {lc.working === 0 ? (
                  <p className="small" style={{ margin: "6px 0" }}>🔗 This file has linked questions, but none of them match your current question bank, so <b>only the plan will be imported</b>, not the links.{pack.questions.length === 0 ? " (No question bank is loaded yet. Load it first if you want the links.)" : ""}</p>
                ) : lc.broken === 0 ? (
                  <p className="small" style={{ margin: "6px 0" }}>🔗 All {lc.total} linked question{lc.total === 1 ? "" : "s"} in this file {lc.total === 1 ? "was" : "were"} found in your question bank, so the links will be imported with the plan.</p>
                ) : (
                  <>
                    <p className="small" style={{ margin: "6px 0" }}>🔗 {lc.broken} of the {lc.total} linked question{lc.total === 1 ? "" : "s"} in this file can't be found in your question bank (or on a date outside this plan). What should happen to the links?</p>
                    <label className="small pi-keep"><input type="radio" name="linkchoice" checked={linkChoice === "working"} onChange={() => setLinkChoice("working")} /> Import the plan and the {lc.working} working link{lc.working === 1 ? "" : "s"}, and drop the broken ones</label>
                    <label className="small pi-keep"><input type="radio" name="linkchoice" checked={linkChoice === "none"} onChange={() => setLinkChoice("none")} /> Import only the plan, with no links</label>
                  </>
                )}
              </div>
            )}
            {custom && !editOnly && (
              <div className="pi-mode" role="radiogroup" aria-label="How to use this file">
                <label className={`pi-opt ${mode === "all" ? "on" : ""}`}>
                  <input type="radio" name="pmode" checked={mode === "all"} onChange={() => setMode("all")} />
                  <span className="pi-opt-t">Replace my whole plan</span>
                  <span className="pi-opt-d">Every day, milestone and link comes from this file.</span>
                </label>
                <label className={`pi-opt ${mode === "dates" ? "on" : ""}`}>
                  <input type="radio" name="pmode" checked={mode === "dates"} onChange={() => setMode("dates")} />
                  <span className="pi-opt-t">Update only the dates in this file</span>
                  <span className="pi-opt-d">The rest of your plan, milestones and ticks stay as they are.</span>
                </label>
              </div>
            )}
            {custom && mode === "dates" && merged ? (
              <>
                <p className="small" style={{ margin: "6px 0" }}>
                  <b>{merged.updated.length}</b> day{merged.updated.length === 1 ? "" : "s"} will be replaced{merged.updated.length ? ` (${merged.updated.slice(0, 6).map(fmtDate).join(", ")}${merged.updated.length > 6 ? ", …" : ""})` : ""} and <b>{merged.added.length}</b> new day{merged.added.length === 1 ? "" : "s"} added{merged.added.length ? ` (${merged.added.slice(0, 6).map(fmtDate).join(", ")}${merged.added.length > 6 ? ", …" : ""})` : ""}. Ticks stay on tasks whose wording is unchanged. If the file has links for a date, they replace that date's links; dates without links in the file keep theirs.
                </p>
                <div className="callout">🔴 CAUTION: the replaced days lose their old tasks and details. Other days, milestones and the plan name are not touched.</div>
                <button className="btn primary" onClick={useDates} disabled={merged.updated.length + merged.added.length === 0}>Update these dates</button>
              </>
            ) : (
              <>
                <div className="callout">🔴 CAUTION: Using this plan replaces your current plan, milestones and question links. Your practice history and mock results are kept.</div>
                <label className="small pi-keep"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Keep my ticked tasks (they match by date and position, so only keep them if the dates overlap)</label>
                <button className="btn primary" onClick={() => (custom ? setAsk("replace") : useIt())}>Use this plan</button>
              </>
            )}
          </div>
        )}
      </section>
      {ask && (
        <ExportFirstModal what="plan" action={ask} oldName={plan.name} newName={p?.name}
          onExport={() => downloadJson(`${fileSafe(plan.name)}.json`, planToJson(plan, curLinks))}
          onGo={() => (ask === "replace" ? useIt() : (remove(), setAsk(null), toast("Plan removed.")))}
          onCancel={() => setAsk(null)} />
      )}
    </div>
  );
}
