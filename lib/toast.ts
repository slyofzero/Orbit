"use client";
// One place to say "that worked": toast("Saved 12 Nov") shows a message at the bottom right of the app (components/Toaster.tsx).
export type ToastKind = "ok" | "warn";
export type ToastDetail = { id: number; text: string; kind: ToastKind };
let next = 1;
export function toast(text: string, kind: ToastKind = /blocked|could not|couldn.t/i.test(text) ? "warn" : "ok") {
  if (typeof window === "undefined" || !text) return;
  window.dispatchEvent(new CustomEvent<ToastDetail>("gate-toast", { detail: { id: next++, text, kind } }));
}
