// Lets any page tell the study buddy how a question or mock went.
export type Outcome = "right" | "wrong" | "skip" | "giveup" | "quit";
const PENDING = "gate.pending-outcome";

/**
 * Fire a reaction. Use `defer: true` on screens that have no buddy (the exam arena):
 * the reaction is kept and shown as soon as the next page with a buddy opens.
 */
export function announce(kind: Outcome, defer = false) {
  if (typeof window === "undefined") return;
  if (defer) {
    try { sessionStorage.setItem(PENDING, kind); } catch {}
    return;
  }
  window.dispatchEvent(new CustomEvent("gate-outcome", { detail: kind }));
}

export function takePending(): Outcome | null {
  try {
    const v = sessionStorage.getItem(PENDING) as Outcome | null;
    if (v) sessionStorage.removeItem(PENDING);
    return v;
  } catch { return null; }
}
