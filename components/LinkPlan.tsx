"use client";
import { useMemo, useState } from "react";
import { downloadText, fileSafe } from "@/lib/download";
import { isTooLong, linkPrompt, parseLinks, readAnswer, Links } from "@/lib/links";
import { ExportButtons, FilesRoute } from "./LinkFiles";
import { KEYS, usePack, usePersisted, usePlan } from "@/lib/store";
import CopyIcon from "@/components/CopyIcon";

// Export plan + question bank for an AI, paste its answer back, and every plan day points at real questions.
export default function LinkPlan({ onDone }: { onDone?: () => void }) {
  const { plan, custom } = usePlan();
  const { pack, custom: hasPack } = usePack();
  const [links, setLinks] = usePersisted<Links>(KEYS.links, {});
  const [withText, setWithText] = useState(true);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const prompt = useMemo(() => (custom && hasPack ? linkPrompt(plan, pack, { withText }, links) : ""), [plan, pack, custom, hasPack, withText, links]);
  const tooLong = isTooLong(prompt);
  const result = useMemo(() => {
    if (!text.trim()) return null;
    const r = readAnswer(text);
    if (r.errors.length) return { links: null, errors: r.errors, warnings: [], days: 0, questions: 0, mocks: 0 };
    const p = parseLinks(r.value, plan, pack);
    return { ...p, warnings: [...r.warnings, ...p.warnings] };
  }, [text, plan, pack]);
  const linked = Object.keys(links).length;

  if (!custom || !hasPack) {
    return <div className="panel"><h2 style={{ marginTop: 0 }}>Link with AI</h2><p className="muted" style={{ margin: 0 }}>Upload a plan and a question pack first. Then an AI can match them.</p></div>;
  }
  const copy = async () => { try { await navigator.clipboard.writeText(prompt); setNote("Copied. Paste it into your AI."); } catch { setNote("Copy was blocked. Use Download instead."); } };

  return (
    <div className="pi">
      <section className="panel pi-now">
        <div className="small muted">Plan and questions linked</div>
        <h2 style={{ margin: "2px 0 4px" }}>{linked ? `${linked} day${linked === 1 ? "" : "s"} linked` : "Not linked yet"}</h2>
        <p className="small muted" style={{ margin: 0 }}>Linked days show their exact questions in the Planner and open in one click.</p>
        {linked > 0 && <div className="row" style={{ marginTop: 12 }}><button className="btn soft" onClick={() => { setLinks({}); setNote("Links cleared."); }}>Clear all links</button></div>}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>1. Give this to an AI</h2>
        {tooLong ? (
          <FilesRoute plan={plan} pack={pack} links={links} size={prompt.length} onNote={setNote} />
        ) : (
          <>
            <p className="muted small">It holds the instructions, your plan and your question bank ({pack.questions.length} questions, {pack.mockTests.length} mock tests).</p>
            <label className="small"><input type="checkbox" checked={withText} onChange={(e) => setWithText(e.target.checked)} /> Include the start of each question (smarter matches, longer text)</label>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary icon-btn" onClick={copy} title="Copy for AI" aria-label="Copy for AI"><CopyIcon /></button>
              <button className="btn" onClick={() => downloadText(`${fileSafe(plan.name)}-link-request.txt`, prompt)}>Download</button>
              <span className="small muted">{Math.round(prompt.length / 1000)}k characters</span>
            </div>
            <p className="small muted" style={{ margin: "10px 0 4px" }}>Prefer files? Export them and attach both to any AI:</p>
            <ExportButtons plan={plan} pack={pack} links={links} onNote={setNote} />
          </>
        )}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>2. Paste its answer</h2>
        <textarea className="pi-text" spellCheck={false} rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder='Paste the AI reply here, e.g. { "days": [ { "date": "2026-11-08", "practice": ["alg-1"] } ] }' />
        {result && result.errors.length > 0 && (
          <div className="pi-err" role="alert">
            <b>🔴 Fix this first:</b>
            <ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}
        {result && result.warnings.length > 0 && <ul className="pi-warn">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
        {result?.links && (
          <div className="pi-ok">
            <p className="small" style={{ margin: "4px 0" }}>{result.days} days linked · {result.questions} different questions · {result.mocks} mock test{result.mocks === 1 ? "" : "s"}</p>
            {linked > 0 && <div className="callout">🔴 CAUTION: Applying this replaces your current links. Your plan, ticks and answers are kept.</div>}
            <button className="btn primary" onClick={() => { setLinks(result.links!); setText(""); setNote(`${result.days} days linked.`); onDone?.(); }}>Apply links</button>
          </div>
        )}
        {note && <p className="small" role="status">{note}</p>}
      </section>
    </div>
  );
}
