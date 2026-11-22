"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { IconSparkle, IconX } from "@/components/icons";
import { IconButton } from "@/components/ui/Button";
import { copyText } from "@/components/ui/CopyButton";
import { txt } from "@/components/utils/txt";
import { cx } from "@/components/utils/cx";

export type ToastTone = "neutral" | "success" | "error" | "special" | "warm"; // warm = special with the warm gradient
/** An optional button on a toast, e.g. "Undo". Clicking it runs `onClick` and closes the toast. */
export type ToastAction = { label: string; onClick: () => void };
type Toast = {
  id: number;
  tone: ToastTone;
  text: ReactNode;
  action?: ToastAction;
  leaving: boolean;
  copied?: boolean;
};

const Ctx = createContext<(text: ReactNode, tone?: ToastTone, action?: ToastAction) => void>(() => {});

const MAX_ON_SCREEN = 3;
const LEAVE_MS = 240; // must match --animate-toast-out in styles/animations/toast.css
const MOVE_MS = 260; // how long the others take to slide into the gap
const SHOW_MS = 5000; // how long every toast stays (longer only while the pointer is over it)
const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The open modal dialog shown last (the one on top), or null. */
function topDialog(): HTMLDialogElement | null {
  const open = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].filter((d) => d.matches(":modal"));
  return open[open.length - 1] ?? null;
}

/** Short feedback in the bottom-right corner that never moves the layout ("Copied", "Saved").
 *  Wrap the app once in <ToastProvider>, then call useToast()("Saved", "success").
 *  `special` = animated gradient with a sparkle, for celebrations. A third argument adds a button
 *  ({ label: "Undo", onClick }). `error` toasts get a Copy button (copies the message). Every toast stays 5 s,
 *  but never leaves while the pointer is over it.
 *  Toasts belong to no screen or dialog: they outlive whatever showed them and sit above everything, open dialogs
 *  included. The stack is a `popover` (the browser's top layer) inside one holder element that is never re-created:
 *  it is moved into the top open modal dialog (else the dialog makes it unclickable) and back to <body> the moment
 *  that dialog closes or is removed, and each move shows the stack again on top.
 *  A toast slides in, and on leaving slides out to the right; the toasts above it then glide down. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const list = useRef<Toast[]>([]);
  list.current = toasts;
  const next = useRef(1);
  const hovered = useRef<number | null>(null);

  // Leaving = play the slide-out, then remove. Removal is on a timer (not animationend) so it
  // still happens when reduced motion switches the animation off.
  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), reducedMotion() ? 0 : LEAVE_MS);
  }, []);
  /** Leaves after `ms`, or later if the pointer is over it then. */
  const dismissLater = useCallback(
    (id: number, ms: number) => {
      setTimeout(() => (hovered.current === id ? dismissLater(id, 1500) : dismiss(id)), ms);
    },
    [dismiss],
  );

  const show = useCallback(
    (text: ReactNode, tone: ToastTone = "neutral", action?: ToastAction) => {
      const id = next.current++;
      const live = list.current.filter((x) => !x.leaving);
      live.slice(0, Math.max(0, live.length - (MAX_ON_SCREEN - 1))).forEach((x) => dismiss(x.id)); // oldest leave
      setToasts((t) => [...t, { id, tone, text, action, leaving: false }]);
      dismissLater(id, SHOW_MS);
    },
    [dismiss, dismissLater],
  );

  const copy = async (t: Toast, el: HTMLElement | null) => {
    const text = typeof t.text === "string" ? t.text : (el?.textContent ?? "");
    if (!(await copyText(text))) return;
    setToasts((all) => all.map((x) => (x.id === t.id ? { ...x, copied: true } : x)));
  };

  // The holder: made once, portalled into, and moved by hand (moving a node keeps the toasts in it, where a new
  // portal target would remount them). It follows the top open modal dialog, else <body>. A dialog can be removed
  // while still open (its screen unmounted mid fade-out), taking the holder with it: then it is simply put back.
  const stack = useRef<HTMLDivElement>(null);
  const [holder, setHolder] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const h = document.createElement("div");
    const place = () => {
      const target = topDialog() ?? document.body;
      if (h.parentElement === target) return;
      target.appendChild(h);
      raise(stack.current); // last in the top layer = above the dialog that just opened
    };
    place();
    setHolder(h);
    const watch = new MutationObserver((records) => {
      if (!h.isConnected || records.some((r) => r.type === "attributes")) place();
    });
    watch.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    return () => {
      watch.disconnect();
      h.remove();
    };
  }, []);
  useLayoutEffect(() => raise(stack.current), [holder]);

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

  const region = (
    <div
      ref={stack}
      popover="manual"
      // the popover's own box styles (inset, margin, border, background, padding) are reset; it sits bottom right
      className="fixed inset-auto right-5 bottom-[calc(20px+env(safe-area-inset-bottom,0px))] z-999 m-0 grid w-[min(380px,calc(100vw-40px))] gap-2 overflow-visible border-0 bg-transparent p-0 text-left max-[560px]:right-4 max-[560px]:left-4 max-[560px]:w-auto"
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
          onPointerEnter={() => (hovered.current = t.id)}
          onPointerLeave={() => {
            if (hovered.current === t.id) hovered.current = null;
          }}
        >
          {(t.tone === "special" || t.tone === "warm") && (
            <IconSparkle className="size-[18px] shrink-0 animate-twinkle" />
          )}
          <span className="min-w-0 flex-1 break-words">{txt(t.text)}</span>
          {t.tone === "error" && (
            <button
              type="button"
              className="-my-1 shrink-0 cursor-pointer rounded-full bg-white/20 px-3 py-[5px] text-[0.85rem] font-bold text-inherit transition-colors duration-150 hover:bg-white/30"
              onClick={(e) => void copy(t, e.currentTarget.parentElement?.querySelector("span") ?? null)}
            >
              {t.copied ? "Copied" : "Copy"}
            </button>
          )}
          {t.action && (
            <button
              type="button"
              className="-my-1 shrink-0 cursor-pointer rounded-full bg-hi px-3.5 py-[5px] text-[0.9rem] font-bold text-hero transition-[filter] duration-150 hover:brightness-110"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
            >
              {txt(t.action.label)}
            </button>
          )}
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
  );

  return (
    <Ctx.Provider value={show}>
      {children}
      {holder && createPortal(region, holder)}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

/** Puts the stack (again) last in the top layer. Hiding first is what moves it up; a stack that was taken out of
 *  the page is already hidden. */
function raise(el: HTMLElement | null) {
  if (!el) return;
  try {
    if (el.matches(":popover-open")) el.hidePopover();
    el.showPopover();
  } catch {
    // no Popover API: the z-index still puts it above the page
  }
}

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
