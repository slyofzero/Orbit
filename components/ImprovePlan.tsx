"use client";
import { useEffect, useMemo, useState } from "react";
import { linkPrompt, Links } from "@/lib/links";
import { KEYS, usePack, usePersisted, usePlan } from "@/lib/store";

const APPS = [
  { name: "Claude", url: "https://claude.ai/new", q: "q", dot: "#d97757" },
  { name: "ChatGPT", url: "https://chatgpt.com/", q: "q", dot: "#10a37f" },
  { name: "Gemini", url: "https://gemini.google.com/app", q: "", dot: "#4285f4" },
  { name: "Grok", url: "https://grok.com/", q: "q", dot: "#9ca3af" },
] as const;
const URL_LIMIT = 6000; // very long links get cut by browsers and sites, so a long prompt travels through the clipboard instead

// A gradient button in the planner header. It opens a window that walks you through getting an AI to match your plan to your questions.
export default function ImprovePlan({ onPaste }: { onPaste: () => void }) {
  const { plan, custom } = usePlan();
  const { pack, custom: hasPack } = usePack();
  const [links, setLinks] = usePersisted<Links>(KEYS.links, {});
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sure, setSure] = useState(false);
  const linked = Object.keys(links).length;
  const ready = custom && hasPack;
  const prompt = useMemo(() => (open && ready ? linkPrompt(plan, pack, { withText: true }, links) : ""), [open, ready, plan, pack, links]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);

  const close = () => { setOpen(false); setNote(""); setSure(false); };
  const go = async (a: (typeof APPS)[number]) => {
    let copied = true;
    try { await navigator.clipboard.writeText(prompt); } catch { copied = false; }
    const direct = a.q && encodeURIComponent(prompt).length < URL_LIMIT;
    window.open(direct ? `${a.url}?${a.q}=${encodeURIComponent(prompt)}` : a.url, "_blank", "noopener");
    setNote(copied ? (direct ? `Opened ${a.name} with your request filled in.` : `Opened ${a.name}. Your request is copied: click its message box and press Ctrl+V.`) : "Copy was blocked by the browser. Close this, press Paste AI answer, and use Download there.");
  };

  const copyOnly = async () => {
    try { await navigator.clipboard.writeText(prompt); setNote("Prompt copied. Paste it into any AI chat with Ctrl+V."); }
    catch { setNote("Copy was blocked by the browser. Press Paste the answer, then use Download in the next screen."); }
  };

  return (
    <>
      <button className="ipm-btn" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.9 5.6L20 9.5l-5.2 2.9L12 22l-2.8-9.6L4 9.5l6.1-1.9L12 2z" /></svg>
        Improve plan
      </button>
      {open && (
        <div className="ipm-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="ipm" role="dialog" aria-modal="true" aria-labelledby="ipm-title">
            <header className="ipm-head">
              <button className="ipm-x" onClick={close} aria-label="Close">×</button>
              <h2 id="ipm-title">Improve your plan</h2>
              <p>Your plan says what to study. An AI can add exactly which questions to solve each day.</p>
            </header>
            {!ready ? (
              <div className="ipm-body"><p>Upload a plan and a question pack first. Then an AI can match them.</p></div>
            ) : (
              <div className="ipm-body">
                <ol className="ipm-steps">
                  <li>
                    <span className="ipm-n">1</span>
                    <div>
                      <b>Pick an AI</b>
                      <p>Your plan and {pack.questions.length} questions are copied for you{linked > 0 ? `, along with your ${linked} linked days so the AI can improve them` : ""}.</p>
                      <div className="ipm-apps">
                        {APPS.map((a) => <button key={a.name} onClick={() => go(a)}><i style={{ background: a.dot }} />{a.name}</button>)}
                      </div>
                      <button className="btn soft ipm-copy" onClick={copyOnly}>Or just copy the prompt</button>
                    </div>
                  </li>
                  <li>
                    <span className="ipm-n">2</span>
                    <div><b>Paste and send</b><p>Click the message box and press Ctrl+V. The AI replies with a short block of JSON.</p></div>
                  </li>
                  <li>
                    <span className="ipm-n">3</span>
                    <div>
                      <b>Bring the answer back</b>
                      <p>Your days fill with real questions, and the best ones show as the main event.{linked > 0 ? " The new answer replaces your current links." : ""}</p>
                      <button className="btn primary" onClick={() => { close(); onPaste(); }}>Paste the answer</button>
                    </div>
                  </li>
                </ol>
                {note && <p className="ipm-note" role="status">{note}</p>}
                {linked > 0 && (
                  <div className="ipm-foot">
                    <span className="small">{linked} day{linked === 1 ? "" : "s"} already linked.</span>
                    {sure ? (
                      <>
                        <button className="btn" onClick={() => { setLinks({}); setSure(false); setNote("Unlinked. Your plan is back to how it was."); }}>Yes, unlink all {linked} days</button>
                        <button className="btn soft" onClick={() => setSure(false)}>Keep them</button>
                      </>
                    ) : <button className="btn soft" onClick={() => setSure(true)}>Unlink questions</button>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
