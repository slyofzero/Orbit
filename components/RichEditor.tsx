"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fromEditorDom, toEditorHtml, safeHref } from "@/lib/richText";

type Btn = { cmd: string; label: string; icon: React.ReactNode; key?: string };
const I = (d: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
const BTNS: Btn[] = [
  { cmd: "bold", label: "Bold (Ctrl+B)", icon: <b>B</b> },
  { cmd: "italic", label: "Italic (Ctrl+I)", icon: <i>I</i> },
  { cmd: "underline", label: "Underline (Ctrl+U)", icon: <u>U</u> },
];
const LISTS: Btn[] = [
  { cmd: "insertUnorderedList", label: "Bulleted list", icon: I("M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01") },
  { cmd: "insertOrderedList", label: "Numbered list", icon: I("M10 6h11M10 12h11M10 18h11M4 5l1-1v4M3.5 13.5c.5-1 2-1 2 .2 0 .8-1.5 1.5-2 2.3h2.2M3.5 19c.8-.5 2-.2 2 .6s-.8 1-1.2 1c.6 0 1.4.2 1.4 1s-1.2 1.2-2.2.7") },
];

/** A small Gmail-style editor. It reads and writes the same text as the old textarea (value / onChange), with <b> <i> <u> <a> <ul> <ol> <li> for formatting. */
export default function RichEditor({ value, onChange, onFocus, rows = 5, label }: { value: string; onChange: (v: string) => void; onFocus?: () => void; rows?: number; label?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const saved = useRef<Range | null>(null);
  const [link, setLink] = useState<{ url: string; x: number; y: number } | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>({});

  // Fill the box on the first render, and whenever the text is changed from outside (e.g. a picture was added).
  useEffect(() => {
    const el = box.current;
    if (el && value !== emitted.current) { el.innerHTML = toEditorHtml(value); emitted.current = value; }
  }, [value]);

  const emit = () => { const el = box.current; if (!el) return; const v = fromEditorDom(el); emitted.current = v; onChange(v); };
  const refresh = () => {
    try { setOn({ bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic"), underline: document.queryCommandState("underline"), insertUnorderedList: document.queryCommandState("insertUnorderedList"), insertOrderedList: document.queryCommandState("insertOrderedList") }); } catch { /* ignore */ }
  };
  const run = (cmd: string, arg?: string) => { box.current?.focus(); document.execCommand(cmd, false, arg); emit(); refresh(); };

  const remember = () => { const s = window.getSelection(); if (s && s.rangeCount && box.current?.contains(s.anchorNode)) saved.current = s.getRangeAt(0).cloneRange(); };
  const openLink = (e: React.MouseEvent<HTMLButtonElement>) => {
    remember();
    const r = e.currentTarget.getBoundingClientRect();
    setLink({ url: "https://", x: r.left, y: r.bottom + 6 });
  };
  const applyLink = () => {
    const url = safeHref(link?.url ?? "");
    setLink(null);
    if (!url) return;
    const el = box.current; if (!el) return;
    el.focus();
    const s = window.getSelection();
    if (saved.current && s) { s.removeAllRanges(); s.addRange(saved.current); }
    if (s && s.isCollapsed) document.execCommand("insertHTML", false, `<a href="${url.replace(/"/g, "&quot;")}">${url.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</a>`);
    else document.execCommand("createLink", false, url);
    emit();
  };

  return (
    <div className="re">
      <div className="re-bar" role="toolbar" aria-label="Formatting">
        {BTNS.map((b) => (
          <button key={b.cmd} type="button" className={"re-b" + (on[b.cmd] ? " on" : "")} title={b.label} aria-label={b.label} onMouseDown={(e) => e.preventDefault()} onClick={() => run(b.cmd)}>{b.icon}</button>
        ))}
        <span className="re-sep" />
        <button type="button" className="re-b" title="Add link" aria-label="Add link" onMouseDown={(e) => e.preventDefault()} onClick={openLink}>{I("M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5")}</button>
        <button type="button" className="re-b" title="Remove link" aria-label="Remove link" onMouseDown={(e) => e.preventDefault()} onClick={() => run("unlink")}>{I("M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71M8 2v3M2 8h3M16 22v-3M22 16h-3")}</button>
        <span className="re-sep" />
        {LISTS.map((b) => (
          <button key={b.cmd} type="button" className={"re-b" + (on[b.cmd] ? " on" : "")} title={b.label} aria-label={b.label} onMouseDown={(e) => e.preventDefault()} onClick={() => run(b.cmd)}>{b.icon}</button>
        ))}
        <span className="re-sep" />
        <button type="button" className="re-b" title="Undo (Ctrl+Z)" aria-label="Undo" onMouseDown={(e) => e.preventDefault()} onClick={() => run("undo")}>{I("M3 7v6h6M3 13a9 9 0 1 0 3-7")}</button>
        <button type="button" className="re-b" title="Redo (Ctrl+Y)" aria-label="Redo" onMouseDown={(e) => e.preventDefault()} onClick={() => run("redo")}>{I("M21 7v6h-6M21 13a9 9 0 1 1-3-7")}</button>
        <button type="button" className="re-b" title="Clear formatting" aria-label="Clear formatting" onMouseDown={(e) => e.preventDefault()} onClick={() => { run("removeFormat"); run("unlink"); }}>{I("M4 7V4h16v3M9 20h6M12 4v16M3 3l18 18")}</button>
      </div>
      <div
        ref={box}
        className="re-body"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        spellCheck={false}
        style={{ minHeight: `${rows * 1.45 + 1.2}em` }}
        onFocus={onFocus}
        onInput={emit}
        onKeyUp={refresh}
        onMouseUp={refresh}
        onBlur={() => { remember(); emit(); }}
        onPaste={(e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); }}
      />
      {link && typeof document !== "undefined" && createPortal(
        <div className="re-pop" style={{ left: Math.max(8, Math.min(link.x, window.innerWidth - 340)), top: link.y }}>
          <input autoFocus className="pk-in" aria-label="Link address" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setLink(null); }} />
          <button type="button" className="btn" onClick={applyLink}>Apply</button>
          <button type="button" className="btn soft" onClick={() => setLink(null)}>Cancel</button>
        </div>, document.body)}
    </div>
  );
}
