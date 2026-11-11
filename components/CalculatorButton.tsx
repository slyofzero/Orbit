"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ScientificCalc from "@/components/ScientificCalc";

/** A small tab stuck to the right edge of the screen, halfway down (icon plus a subtle arrow pointing left, like a drawer handle). It stays there while you scroll and
 *  sits in the page margin, so it covers nothing. Click it to open or close the floating scientific calculator. Render it anywhere on a page. */
export default function CalculatorButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  // in a portal: the page's entrance animation and loading blur must not touch a fixed tab
  return createPortal(
    <>
      <button type="button" className="calc-fab" onClick={() => setOpen((o) => !o)} aria-pressed={open} aria-label="Calculator" title="Calculator">
        <svg className="calc-arrow" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 1L1.5 6 6 11" /></svg>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2.5" /><rect x="8" y="6" width="8" height="3.5" rx="0.8" /><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" strokeWidth="2.4" /></svg>
      </button>
      {open && <ScientificCalc onClose={() => setOpen(false)} />}
    </>,
    document.body
  );
}
