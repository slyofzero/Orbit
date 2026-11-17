"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./Button";
import { Heading } from "./Heading";
import { IconX } from "./icons";
import { SparkleBadge } from "./Special";
import { txt } from "./txt";
import { cx } from "./cx";

const CLOSE_MS = 200;   // must match ui-dialog-out in app/site.css
const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Modal dialog on the native <dialog>: traps focus, closes on Esc and on a click outside.
 *  Opens with a fade + rise over a frosted backdrop, and closes with the reverse.
 *  `special` = animated gradient border, gradient title and a sparkle badge (celebrations). */
export function Dialog({ open, onClose, title, children, footer, special = false }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; special?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      d.classList.remove("is-closing");          // reopened while still closing: just stay open
      if (!d.open) d.showModal();
      return;
    }
    if (!d.open) return;
    if (reducedMotion()) { d.close(); return; }
    d.classList.add("is-closing");               // play the fade-out, then really close
    const t = setTimeout(() => { d.classList.remove("is-closing"); d.close(); }, CLOSE_MS);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx("ui-dialog", special && "is-special")}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}            // Esc
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} // click on the backdrop
    >
      <div className="ui-dialog-head">
        {special && <SparkleBadge />}
        <Heading level={2} id={titleId} special={special} className="ui-dialog-title">{title}</Heading>
        <IconButton label="Close" onClick={onClose}><IconX /></IconButton>
      </div>
      <div className="ui-dialog-body">{txt(children)}</div>
      {footer && <div className="ui-dialog-foot">{footer}</div>}
    </dialog>
  );
}
