"use client";
import { useEffect, useRef } from "react";
import { VEIL_KEY } from "@/lib/profiles";

// The curtain shown while switching profiles. The inline script in app/layout.tsx raises it before first paint
// after a reload, so there is no flash of the old profile; once the app is ready it fades away here.
export default function Veil() {
  const nameRef = useRef<HTMLElement>(null);
  const noteRef = useRef<HTMLElement>(null);
  const avRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = document.documentElement;
    if (!el.dataset.switching) return;
    try {
      const v = JSON.parse(sessionStorage.getItem(VEIL_KEY) ?? "null") as { name: string; note: string } | null;
      if (v) {
        if (nameRef.current) nameRef.current.textContent = v.name;
        if (noteRef.current) noteRef.current.textContent = v.note;
        if (avRef.current) avRef.current.textContent = v.name.slice(0, 1).toUpperCase();
      }
      sessionStorage.removeItem(VEIL_KEY);
    } catch { /* ignore */ }
    // hold the curtain briefly so the new profile has painted, then lift it
    const t = setTimeout(() => { delete el.dataset.switching; }, 650);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="veil" id="veil" aria-hidden="true">
      <div className="veil-card">
        <span className="veil-av" data-veil-av ref={avRef} suppressHydrationWarning />
        <b data-veil-name ref={nameRef} suppressHydrationWarning />
        <small data-veil-note ref={noteRef} suppressHydrationWarning />
      </div>
    </div>
  );
}
