"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A full-page loading state: the whole page behind it is blurred (including its first line) and a small orbit animation with the word
// "Loading" sits in the middle. Keep it mounted and flip `active`: it only appears if the wait lasts more than a moment (no flash on fast
// loads), and once shown it stays long enough to be read (no flicker). The blur is a `data-page-loading` flag on <html> (see .page-enter
// in site.css), so it works on any page without wrapping its content.
const SHOW_AFTER_MS = 150, MIN_VISIBLE_MS = 600;
export default function PageLoading({ active = true, label = "Loading" }: { active?: boolean; label?: string }) {
  const [shown, setShown] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (active && !shown) t = setTimeout(() => { since.current = Date.now(); setShown(true); }, SHOW_AFTER_MS);
    else if (!active && shown) t = setTimeout(() => setShown(false), Math.max(0, MIN_VISIBLE_MS - (Date.now() - since.current)));
    return () => clearTimeout(t);
  }, [active, shown]);
  useEffect(() => {
    if (!shown) return;
    document.documentElement.dataset.pageLoading = "1";
    return () => { delete document.documentElement.dataset.pageLoading; };
  }, [shown]);
  if (!shown) return null;
  return createPortal(
    <div className="pgl" role="status" aria-live="polite" aria-label={label}>
      <div className="pgl-box">
        <div className="pgl-orbit" aria-hidden="true">
          <i className="pgl-core" />
          <b className="pgl-ring r1"><s /></b>
          <b className="pgl-ring r2"><s /></b>
          <b className="pgl-ring r3"><s /></b>
        </div>
        <div className="pgl-text" aria-hidden="true">
          {label.split("").map((c, i) => <span key={i} style={{ "--i": i } as React.CSSProperties}>{c}</span>)}
          <em>.</em><em>.</em><em>.</em>
        </div>
      </div>
    </div>,
    document.body,
  );
}
