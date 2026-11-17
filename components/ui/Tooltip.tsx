"use client";
// Tooltip: a small bubble shown while the pointer is over (or keyboard focus is on) an element.
// HelpTip: the round "?" icon to put beside any piece of text; hovering, focusing or tapping it shows the tip.
// Tips are for extra explanation only: never hide something the user must know to finish a task.

import { cloneElement, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { txt } from "./txt";
import { Dialog } from "./Dialog";
import { useDismiss } from "./useDismiss";
import { IconHelp } from "./icons";
import { cx } from "./cx";

export type TipPlacement = "top" | "bottom" | "left" | "right";

const OPEN_DELAY = 120;   // ms: stops tips flashing while the pointer passes over
const CLOSE_DELAY = 80;

function useTip() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const later = (v: boolean, ms: number) => { clear(); timer.current = setTimeout(() => setOpen(v), ms); };
  useEffect(() => clear, []);
  return {
    open, setOpen,
    show: () => later(true, OPEN_DELAY),
    hide: () => later(false, CLOSE_DELAY),
    showNow: () => { clear(); setOpen(true); },
    hideNow: () => { clear(); setOpen(false); },
  };
}

/** Tip text renders as markdown + maths (strings, and JSX text with {…} pieces in it). */
const tipBody = (content: ReactNode) => txt(content);

/** Wraps ONE focusable element (a button, a link, an input). */
export function Tooltip({ content, placement = "top", children }: {
  content: ReactNode; placement?: TipPlacement; children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const tip = useTip();
  useEffect(() => {
    if (!tip.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") tip.hideNow(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tip.open]); // eslint-disable-line react-hooks/exhaustive-deps

  const child = isValidElement(children) ? cloneElement(children, { "aria-describedby": tip.open ? id : undefined }) : children;
  return (
    <span className="ui-tip-wrap" onPointerEnter={tip.show} onPointerLeave={tip.hide} onFocus={tip.showNow} onBlur={tip.hideNow}>
      {child}
      {tip.open && <span id={id} role="tooltip" className="ui-tip" data-place={placement}>{tipBody(content)}</span>}
    </span>
  );
}

/** A "?" icon that explains the text next to it. Put it right after the text it explains. */
export function HelpTip({ children, label = "More information", placement = "top", className }: {
  children: ReactNode; label?: string; placement?: TipPlacement; className?: string;
}) {
  const id = useId();
  const tip = useTip();
  const [pinned, setPinned] = useState(false);          // opened by a click/tap: stays until dismissed
  const wrap = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => { setPinned(false); tip.hideNow(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const refs = useMemo(() => [wrap], []);
  useDismiss(tip.open, close, refs);

  return (
    <span ref={wrap} className={cx("ui-tip-wrap", className)}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") tip.show(); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse" && !pinned) tip.hide(); }}>
      <button type="button" className={cx("ui-help", tip.open && "is-open")} aria-label={label}
        aria-describedby={tip.open ? id : undefined} aria-expanded={tip.open}
        onFocus={tip.showNow} onBlur={() => { if (!pinned) tip.hideNow(); }}
        onClick={() => { if (pinned) close(); else { setPinned(true); tip.showNow(); } }}>
        <IconHelp />
      </button>
      {tip.open && <span id={id} role="tooltip" className="ui-tip" data-place={placement}>{tipBody(children)}</span>}
    </span>
  );
}

/** A "big tooltip": the same "?" trigger as HelpTip (optionally followed by text, e.g. "Formatting help"),
 *  but it opens a dialog, for help too long for a small bubble (tables, examples, several paragraphs). */
export function HelpDialog({ title, label, children, special = false }: {
  title: ReactNode; label?: ReactNode; children: ReactNode; special?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={cx("ui-helpdlg", label ? "has-label" : null)} aria-haspopup="dialog"
        aria-label={label ? undefined : typeof title === "string" ? `Help: ${title}` : "Help"} onClick={() => setOpen(true)}>
        <span className="ui-help" aria-hidden="true"><IconHelp /></span>
        {label && <span className="ui-helpdlg-label">{txt(label)}</span>}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} special={special}>{children}</Dialog>
    </>
  );
}
