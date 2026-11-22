"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconChevronRight } from "@/components/icons";
import { txt } from "@/components/utils/txt";
import { cx } from "@/components/utils/cx";

const BODY = "grid gap-2.5 pt-1 pr-3.5 pb-3.5 pl-[38px]";
/** How long the body takes to open or shut (keep in step with styles/animations/disclosure.css). */
const MOTION_MS = 340;

/** Show / hide extra content (help, advanced options). Built on <details>, so it works without JS.
 *  Uncontrolled by default (`defaultOpen`). Pass `open` + `onOpenChange` to control it from outside, e.g.
 *  to force it open while a search is running. `bodyClassName` replaces the body's padding and layout
 *  (default: indented under the title, children stacked).
 *  Opening and closing animate (the body grows / shrinks and fades): the <details> stays open while it shuts,
 *  and the body expands a frame after it opens, so the change has something to move from. */
export function Disclosure({
  title,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const controlled = open !== undefined;
  const [own, setOwn] = useState(defaultOpen);
  const want = controlled ? open : own; // what the reader asked for
  const [attr, setAttr] = useState(want); // the <details> open attribute: stays on while it shuts
  const [expanded, setExpanded] = useState(want); // the body at full height
  const [settled, setSettled] = useState(true); // not moving: the body may overflow (pop-ups, focus rings)
  const last = useRef(want);

  useEffect(() => {
    if (last.current === want) return;
    last.current = want;
    setSettled(false);
    if (want) {
      setAttr(true);
      // two frames: the browser first lays out the shut body, then animates to the open one
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setExpanded(true));
      });
      const done = setTimeout(() => setSettled(true), MOTION_MS + 40);
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(done);
      };
    }
    setExpanded(false);
    const done = setTimeout(() => {
      setAttr(false);
      setSettled(true);
    }, MOTION_MS);
    return () => clearTimeout(done);
  }, [want]);

  const ask = (next: boolean) => {
    if (!controlled) setOwn(next);
    onOpenChange?.(next);
  };

  return (
    <details
      className={cx("rounded-md border border-line bg-sheet", className)}
      open={attr || undefined}
      // the browser can open it by itself (e.g. find in page): follow it
      onToggle={(e) => {
        if (e.currentTarget.open && !want) ask(true);
      }}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3.5 py-2.5 font-bold select-none hover:bg-sheet-2 [&::-webkit-details-marker]:hidden [[open]>&]:rounded-b-none"
        onClick={(e) => {
          e.preventDefault(); // we open and shut it, so it can animate both ways
          ask(!want);
        }}
      >
        <IconChevronRight
          className={cx("size-4 shrink-0 text-gray transition-transform duration-200", expanded && "rotate-90")}
        />
        {txt(title)}
      </summary>
      <div
        className="disclosure-motion"
        data-expanded={expanded || undefined}
        data-settled={(settled && expanded) || undefined}
      >
        <div>
          <div className={bodyClassName ?? BODY}>{children}</div>
        </div>
      </div>
    </details>
  );
}
