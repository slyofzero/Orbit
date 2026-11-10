"use client";
import { useState } from "react";
import ScientificCalc from "@/components/ScientificCalc";

/** A calculator button pinned to the top right of the page (it stays put while you scroll); opens the floating scientific calculator. */
export default function CalculatorButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="calc-fab" onClick={() => setOpen((o) => !o)} aria-pressed={open} title="Calculator">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2.5" /><rect x="8" y="6" width="8" height="3.5" rx="0.8" /><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" strokeWidth="2.4" /></svg>
        Calculator
      </button>
      {open && <ScientificCalc onClose={() => setOpen(false)} />}
    </>
  );
}
