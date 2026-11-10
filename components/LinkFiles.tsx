"use client";
import type { PackData } from "@/lib/packs";
import type { PlanData } from "@/lib/plan";
import { bankFile, filesPrompt, Links, planFile } from "@/lib/links";
import { downloadJson, fileSafe } from "@/lib/download";
import CopyIcon from "@/components/CopyIcon";

// Two separate JSON files (your plan, your question bank) for banks too big to paste, plus the short prompt that goes with them.
export function ExportButtons({ plan, pack, links, onNote }: { plan: PlanData; pack: PackData; links: Links; onNote?: (s: string) => void }) {
  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      <button className="btn soft" onClick={() => { downloadJson("plan.json", planFile(plan, links, pack)); onNote?.("Saved plan.json."); }}>Export plan (plan.json)</button>
      <button className="btn soft" onClick={() => { downloadJson("question-bank.json", bankFile(pack)); onNote?.("Saved question-bank.json."); }}>Export question bank (question-bank.json)</button>
    </div>
  );
}

export function FilesRoute({ plan, pack, links, size, onNote }: { plan: PlanData; pack: PackData; links: Links; size: number; onNote: (s: string) => void }) {
  const count = pack.questions.length;
  const prompt = filesPrompt(Object.keys(links).length > 0);
  const copy = async () => { try { await navigator.clipboard.writeText(prompt); onNote("Prompt copied. Paste it into the AI chat after attaching both files."); } catch { onNote("Copy was blocked by the browser. Select the prompt text and copy it by hand."); } };
  return (
    <div>
      <p className="small" style={{ margin: "0 0 8px", color: "var(--bad, #c0392b)" }}>🔴 CAUTION: your question bank is too big to paste ({Math.round(size / 1000)}k characters). Do NOT paste the long prompt. Send two files instead:</p>
      <ol className="ipm-sub">
        <li>Export both files below.</li>
        <li>Open any AI that accepts file uploads and attach both files.</li>
        <li>Press the copy button below, paste the short prompt into the chat and send it.</li>
      </ol>
      <p className="small" style={{ margin: "0 0 10px", color: "var(--bad, #c0392b)" }}>🔴 CAUTION: some AIs cannot read a file this big (token limits) and may quietly read only the first part. Use an AI with a large context window, such as Gemini, Claude or ChatGPT on a paid plan. Before sending the prompt, ask it: "How many items are in the questions list of question-bank.json?" The answer must be {count.toLocaleString()}. If it gives another number, do NOT continue: start a new chat or try another AI.</p>
      <ExportButtons plan={plan} pack={pack} links={links} onNote={onNote} />
      <div className="row" style={{ marginTop: 8 }}><button className="btn primary icon-btn" onClick={copy} title="Copy the short prompt" aria-label="Copy the short prompt"><CopyIcon /></button></div>
      <textarea readOnly className="pi-text" rows={4} value={prompt} onFocus={(e) => e.currentTarget.select()} style={{ marginTop: 8 }} />
    </div>
  );
}
