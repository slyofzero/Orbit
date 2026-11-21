"use client";
// Tooltip: a small bubble shown while the pointer is over (or keyboard focus is on) an element.
// HelpTip: the round "?" icon to put beside any piece of text; hovering, focusing or tapping it shows the tip.
// Tips are for extra explanation only: never hide something the user must know to finish a task.

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { txt } from "@/components/utils/txt";
import { Dialog } from "@/components/ui/Dialog";
import { useDismiss } from "@/components/utils/useDismiss";
import { IconHelp } from "@/components/icons";
import { cx } from "@/components/utils/cx";

export type TipPlacement = "top" | "bottom" | "left" | "right";

const OPEN_DELAY = 120; // ms: stops tips flashing while the pointer passes over
const CLOSE_DELAY = 80;

function useTip() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const later = (v: boolean, ms: number) => {
    clear();
    timer.current = setTimeout(() => setOpen(v), ms);
  };
  useEffect(() => clear, []);
  return {
    open,
    setOpen,
    show: () => later(true, OPEN_DELAY),
    hide: () => later(false, CLOSE_DELAY),
    showNow: () => {
      clear();
      setOpen(true);
    },
    hideNow: () => {
      clear();
      setOpen(false);
    },
  };
}

const WRAP = "relative inline-flex items-center align-middle";
// `popover` puts the bubble in the browser's top layer, above every card, stacking context and open dialog;
// it is placed with `fixed` coordinates by TipBubble. The z-index only matters where popovers are unsupported.
const BUBBLE =
  "pointer-events-none fixed inset-auto z-[2147483647] m-0 w-max max-w-[min(280px,72vw)] animate-tip-in overflow-visible rounded-[10px] border-0 bg-ink px-3 py-2 text-left font-body text-[0.84rem] leading-[1.45] font-semibold tracking-normal whitespace-normal text-sheet shadow-lg after:absolute after:size-[9px] after:rotate-45 after:bg-inherit after:content-[''] [&_a]:text-inherit [&_code]:bg-sheet/18 [&_code]:text-inherit";
// the little square (::after) is the arrow; --tip-arrow keeps it on the element when the bubble is pushed in from an edge
const PLACE: Record<TipPlacement, string> = {
  top: "after:top-[calc(100%-5px)] after:left-[calc(var(--tip-arrow,50%)-4.5px)]",
  bottom: "after:bottom-[calc(100%-5px)] after:left-[calc(var(--tip-arrow,50%)-4.5px)]",
  right: "after:top-[calc(var(--tip-arrow,50%)-4.5px)] after:right-[calc(100%-5px)]",
  left: "after:top-[calc(var(--tip-arrow,50%)-4.5px)] after:left-[calc(100%-5px)]",
};
const GAP = 9; // px between the element and the bubble
const EDGE = 8; // px the bubble keeps from the window's edges
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** The bubble, shown in the top layer beside `anchor`; follows it on scroll and resize. */
function TipBubble({
  id,
  anchor,
  placement,
  children,
}: {
  id: string;
  anchor: RefObject<HTMLElement | null>;
  placement: TipPlacement;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const a = anchor.current;
    if (!el || !a) return;
    try {
      el.showPopover();
    } catch {
      // no Popover API: the bubble still shows, fixed, with the big z-index
    }
    const place = () => {
      const r = a.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      let left: number;
      let top: number;
      let arrow: number;
      if (placement === "top" || placement === "bottom") {
        const mid = r.left + r.width / 2;
        left = clamp(mid - w / 2, EDGE, window.innerWidth - w - EDGE);
        top = placement === "top" ? r.top - GAP - h : r.bottom + GAP;
        arrow = clamp(mid - left, 12, w - 12);
      } else {
        const mid = r.top + r.height / 2;
        top = clamp(mid - h / 2, EDGE, window.innerHeight - h - EDGE);
        left = placement === "left" ? r.left - GAP - w : r.right + GAP;
        arrow = clamp(mid - top, 12, h - 12);
      }
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.setProperty("--tip-arrow", `${arrow}px`);
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      try {
        el.hidePopover();
      } catch {
        // already hidden or unsupported
      }
    };
  }, [anchor, placement]);
  return (
    <span ref={ref} id={id} role="tooltip" popover="manual" className={cx(BUBBLE, PLACE[placement])}>
      {children}
    </span>
  );
}
/** The round "?" (a bit bigger inside h1 / h2). `lit` = highlighted (open, or its parent is hovered). */
const helpIcon = (lit: boolean, margin = true) =>
  cx(
    "inline-grid size-[18px] shrink-0 place-items-center rounded-full p-0 transition-colors duration-150 [&_svg]:size-[13px] [&_svg]:stroke-[2.6]",
    "[h1_&]:size-[22px] [h2_&]:size-[22px] [h1_&]:[&_svg]:size-[15px] [h2_&]:[&_svg]:size-[15px]",
    margin && "ml-[5px]",
    lit ? "bg-accent-soft text-accent" : "bg-sheet-2 text-gray",
  );

/** Tip text renders as markdown + maths (strings, and JSX text with {…} pieces in it). */
const tipBody = (content: ReactNode) => txt(content);

/** Wraps ONE focusable element (a button, a link, an input). */
export function Tooltip({
  content,
  placement = "top",
  className,
  children,
}: {
  content: ReactNode;
  placement?: TipPlacement;
  /** replaces the wrapper's inline layout, e.g. to fill a chart column */
  className?: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const tip = useTip();
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!tip.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tip.hideNow();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tip.open]); // eslint-disable-line react-hooks/exhaustive-deps

  const child = isValidElement(children)
    ? cloneElement(children, { "aria-describedby": tip.open ? id : undefined })
    : children;
  return (
    <span
      ref={wrap}
      className={className ? cx("relative", className) : WRAP}
      onPointerEnter={tip.show}
      onPointerLeave={tip.hide}
      onFocus={tip.showNow}
      onBlur={tip.hideNow}
    >
      {child}
      {tip.open && (
        <TipBubble id={id} anchor={wrap} placement={placement}>
          {tipBody(content)}
        </TipBubble>
      )}
    </span>
  );
}

/** A "?" icon that explains the text next to it. Put it right after the text it explains. */
export function HelpTip({
  children,
  label = "More information",
  placement = "top",
  className,
}: {
  children: ReactNode;
  label?: string;
  placement?: TipPlacement;
  className?: string;
}) {
  const id = useId();
  const tip = useTip();
  const [pinned, setPinned] = useState(false); // opened by a click/tap: stays until dismissed
  const wrap = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => {
    setPinned(false);
    tip.hideNow();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const refs = useMemo(() => [wrap], []);
  useDismiss(tip.open, close, refs);

  return (
    <span
      ref={wrap}
      className={cx(WRAP, className)}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") tip.show();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse" && !pinned) tip.hide();
      }}
    >
      <button
        type="button"
        className={cx(helpIcon(tip.open), "cursor-help", !tip.open && "hover:bg-accent-soft hover:text-accent")}
        aria-label={label}
        aria-describedby={tip.open ? id : undefined}
        aria-expanded={tip.open}
        onFocus={tip.showNow}
        onBlur={() => {
          if (!pinned) tip.hideNow();
        }}
        onClick={() => {
          if (pinned) close();
          else {
            setPinned(true);
            tip.showNow();
          }
        }}
      >
        <IconHelp />
      </button>
      {tip.open && (
        <TipBubble id={id} anchor={wrap} placement={placement}>
          {tipBody(children)}
        </TipBubble>
      )}
    </span>
  );
}

/** A "big tooltip": the same "?" trigger as HelpTip (optionally followed by text, e.g. "Formatting help"),
 *  but it opens a dialog, for help too long for a small bubble (tables, examples, several paragraphs). */
export function HelpDialog({
  title,
  label,
  children,
  special = false,
}: {
  title: ReactNode;
  label?: ReactNode;
  children: ReactNode;
  special?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        className={cx(
          "group inline-flex cursor-help items-center gap-1.5 p-0 align-middle font-body text-[0.85rem] font-bold text-ink-2",
          !label && "ml-[5px]",
        )}
        aria-label={label ? undefined : typeof title === "string" ? `Help: ${title}` : "Help"}
        onClick={() => setOpen(true)}
      >
        <span
          className={cx(
            helpIcon(false, false),
            "group-hover:bg-accent-soft group-hover:text-accent group-focus-visible:bg-accent-soft group-focus-visible:text-accent",
          )}
          aria-hidden="true"
        >
          <IconHelp />
        </span>
        {label && <span className="group-hover:text-accent">{txt(label)}</span>}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} special={special}>
        {children}
      </Dialog>
    </>
  );
}
