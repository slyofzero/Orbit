"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ToastDetail } from "@/lib/toast";

const SHOW_MS = 5000, SHOW_WARN_MS = 7000, MAX = 4;

// Toasts at the bottom right of the app. Click one to dismiss it; otherwise it goes away by itself.
export default function Toaster() {
  const [items, setItems] = useState<ToastDetail[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<ToastDetail>).detail;
      setItems((p) => [...p.slice(-(MAX - 1)), t]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== t.id)), t.kind === "warn" ? SHOW_WARN_MS : SHOW_MS);
    };
    window.addEventListener("gate-toast", on);
    return () => window.removeEventListener("gate-toast", on);
  }, []);
  if (!mounted) return null;
  return createPortal(
    <div className="gt-wrap" aria-live="polite">
      {items.map((t) => (
        <button key={t.id} className={`gt ${t.kind}`} role="status" onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))} title="Click to dismiss">
          <span className="gt-ic" aria-hidden="true">{t.kind === "ok" ? "✓" : "!"}</span>
          <span className="gt-tx">{t.text}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
