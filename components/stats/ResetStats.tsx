"use client";
import { useEffect, useState } from "react";
import { KEYS, usePersisted } from "@/lib/store";

const PHRASE = "Reset Stats";

// "Reset stats" button and its confirmation window. You must type the exact phrase before anything is deleted.
export default function ResetStats({ onExport, onDone }: { onExport: () => void; onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [, setLog] = usePersisted<unknown[]>(KEYS.plog, []);
  const [, setViews] = usePersisted<unknown[]>(KEYS.views, []);
  const [, setPractice] = usePersisted<Record<string, unknown>>(KEYS.practice, {});
  const [, setFixed] = usePersisted<Record<string, unknown>>(KEYS.fixed, {});
  const [, setAttempts] = usePersisted<unknown[]>(KEYS.attempts, []);
  const close = () => { setOpen(false); setText(""); };

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);

  const ok = text === PHRASE;
  const reset = () => {
    if (!ok) return;
    setLog([]); setViews([]); setPractice({}); setFixed({}); setAttempts([]);
    close();
    onDone("Stats reset. Your plan, question pack, ticked tasks and links were not touched.");
  };

  return (
    <>
      <button className="btn soft" onClick={() => setOpen(true)}>Reset stats</button>
      {open && (
        <div className="xf-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="xf-modal" role="dialog" aria-modal="true" aria-labelledby="rs-title">
            <h2 id="rs-title">Reset all stats?</h2>
            <p className="small" style={{ color: "var(--bad, #c0392b)" }}>🔴 CAUTION: this cannot be undone. It deletes:</p>
            <ul className="small" style={{ margin: "0 0 10px", paddingLeft: 20 }}>
              <li>every practice answer, view and time</li>
              <li>your right and wrong record and the mistakes you have re-solved</li>
              <li>all mock test attempts and scores</li>
            </ul>
            <p className="small muted">Kept: your plan, question pack, ticked tasks and links.</p>
            <p className="small" style={{ marginBottom: 4 }}>Type <b>{PHRASE}</b> to confirm:</p>
            <input className="natinput" autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && reset()} placeholder={PHRASE} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label={`Type ${PHRASE} to confirm`} />
            <div className="xf-actions">
              <button className="btn soft" onClick={onExport}>Export to Excel first</button>
              <button className="btn primary" disabled={!ok} onClick={reset}>Reset stats</button>
              <button className="btn" onClick={close}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
