"use client";
import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { IconSparkle, IconX } from "./icons";
import { IconButton } from "./Button";
import { txt } from "./txt";
import { cx } from "./cx";

export type ToastTone = "neutral" | "success" | "error" | "special" | "warm"; // warm = special with the warm gradient
type Toast = { id: number; tone: ToastTone; text: ReactNode; leaving: boolean };

const Ctx = createContext<(text: ReactNode, tone?: ToastTone) => void>(() => {});

const MAX_ON_SCREEN = 3;
const LEAVE_MS = 240; // must match --animate-toast-out in app/site.css
const MOVE_MS = 260; // how long the others take to slide into the gap
const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Short feedback in the bottom-right corner that never moves the layout ("Copied", "Saved").
 *  Wrap the app once in <ToastProvider>, then call useToast()("Saved", "success").
 *  `special` = animated gradient with a sparkle, for celebrations.
 *  A toast slides in, and on leaving slides out to the right; the toasts above it then glide down. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const list = useRef<Toast[]>([]);
  list.current = toasts;
  const next = useRef(1);

  // Leaving = play the slide-out, then remove. Removal is on a timer (not animationend) so it
  // still happens when reduced motion switches the animation off.
  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), reducedMotion() ? 0 : LEAVE_MS);
  }, []);

  const show = useCallback(
    (text: ReactNode, tone: ToastTone = "neutral") => {
      const id = next.current++;
      const live = list.current.filter((x) => !x.leaving);
      live.slice(0, Math.max(0, live.length - (MAX_ON_SCREEN - 1))).forEach((x) => dismiss(x.id)); // oldest leave
      setToasts((t) => [...t, { id, tone, text, leaving: false }]);
      setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3500);
    },
    [dismiss],
  );

  // FLIP: after every change, toasts whose position moved animate from where they were to where they are.
  const els = useRef(new Map<number, HTMLDivElement>());
  const tops = useRef(new Map<number, number>());
  useLayoutEffect(() => {
    const now = new Map<number, number>();
    els.current.forEach((el, id) => {
      const top = el.getBoundingClientRect().top;
      now.set(id, top);
      const before = tops.current.get(id);
      if (before !== undefined && Math.abs(before - top) > 0.5 && !reducedMotion()) {
        el.animate([{ translate: `0 ${before - top}px` }, { translate: "0 0" }], {
          duration: MOVE_MS,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      }
    });
    tops.current = now;
  }, [toasts]);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div
        className="fixed right-5 bottom-[calc(20px+env(safe-area-inset-bottom,0px))] z-100 grid w-[min(380px,calc(100vw-40px))] gap-2 max-[560px]:right-4 max-[560px]:left-4 max-[560px]:w-auto"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={toastClass(t)}
            ref={(el) => {
              if (el) els.current.set(t.id, el);
              else els.current.delete(t.id);
            }}
          >
            {(t.tone === "special" || t.tone === "warm") && (
              <IconSparkle className="size-[18px] shrink-0 animate-twinkle" />
            )}
            <span className="flex-1">{txt(t.text)}</span>
            <IconButton
              label="Dismiss"
              size="sm"
              variant="ghost"
              className="-my-1 -mr-1.5 text-inherit! opacity-85 enabled:hover:bg-current/16! enabled:hover:opacity-100"
              onClick={() => dismiss(t.id)}
            >
              <IconX />
            </IconButton>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

const TONE: Record<ToastTone, string> = {
  neutral: "bg-ink text-sheet",
  success: "bg-green text-white",
  error: "bg-red text-white",
  special: "special-fill",
  warm: "special-fill warm",
};

function toastClass(t: Toast): string {
  const sp = t.tone === "special" || t.tone === "warm";
  return cx(
    "flex items-center gap-2.5 rounded-md px-3.5 py-3 text-[0.92rem] font-bold shadow-lg",
    TONE[t.tone],
    t.leaving
      ? cx("pointer-events-none", sp ? "animate-toast-out-flow" : "animate-toast-out")
      : sp
        ? "animate-toast-in-flow"
        : "animate-toast-in",
  );
}
