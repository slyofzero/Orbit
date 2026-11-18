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
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { txt } from "@/components/ui/txt";
import { Dialog } from "@/components/ui/Dialog";
import { useDismiss } from "@/components/ui/useDismiss";
import { IconHelp } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";

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
const BUBBLE =
  "pointer-events-none absolute z-60 w-max max-w-[min(280px,72vw)] animate-tip-in rounded-[10px] bg-ink px-3 py-2 text-left font-body text-[0.84rem] leading-[1.45] font-semibold tracking-normal whitespace-normal text-sheet shadow-lg after:absolute after:size-[9px] after:rotate-45 after:bg-inherit after:content-[''] [&_a]:text-inherit [&_code]:bg-sheet/18 [&_code]:text-inherit";
// the bubble sits beside the element; the little square (::after) is its arrow
const PLACE: Record<TipPlacement, string> = {
  top: "bottom-[calc(100%+9px)] left-1/2 -translate-x-1/2 after:top-[calc(100%-5px)] after:left-[calc(50%-4.5px)]",
  bottom: "top-[calc(100%+9px)] left-1/2 -translate-x-1/2 after:bottom-[calc(100%-5px)] after:left-[calc(50%-4.5px)]",
  right: "top-1/2 left-[calc(100%+9px)] -translate-y-1/2 after:top-[calc(50%-4.5px)] after:right-[calc(100%-5px)]",
  left: "top-1/2 right-[calc(100%+9px)] -translate-y-1/2 after:top-[calc(50%-4.5px)] after:left-[calc(100%-5px)]",
};
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
  children,
}: {
  content: ReactNode;
  placement?: TipPlacement;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const tip = useTip();
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
      className={WRAP}
      onPointerEnter={tip.show}
      onPointerLeave={tip.hide}
      onFocus={tip.showNow}
      onBlur={tip.hideNow}
    >
      {child}
      {tip.open && (
        <span id={id} role="tooltip" className={cx(BUBBLE, PLACE[placement])}>
          {tipBody(content)}
        </span>
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
        <span id={id} role="tooltip" className={cx(BUBBLE, PLACE[placement])}>
          {tipBody(children)}
        </span>
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
