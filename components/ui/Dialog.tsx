"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "@/components/ui/Button";
import { Heading } from "@/components/ui/Heading";
import { IconX } from "@/components/icons";
import { GLOW, SparkleBadge, type Glow } from "@/components/ui/Special";
import { txt } from "@/components/utils/txt";
import { cx } from "@/components/utils/cx";

const CLOSE_MS = 200; // must match --animate-dialog-out in styles/animations/dialog.css
const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// open: fade + rise in over a frosted backdrop; data-closing (set below while it fades out): the reverse
const OPENING = "[&[open]:not([data-closing])]:backdrop:animate-fade-in";
const CLOSING = "[&[open][data-closing]]:backdrop:animate-fade-out";

/** Modal dialog on the native <dialog>: traps focus, closes on Esc and on a click outside.
 *  Opens with a fade + rise over a frosted backdrop, and closes with the reverse.
 *  `special` = animated gradient border, gradient title and a sparkle badge (celebrations);
 *  `glow` = how strongly it glows (low · medium · high, default medium);
 *  `shake` = shakes a little as it opens (a warning that needs attention, e.g. leaving a mock's full screen). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  special = false,
  glow = "medium",
  shake = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  special?: boolean;
  glow?: Glow;
  shake?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      delete d.dataset.closing; // reopened while still closing: just stay open
      if (!d.open) d.showModal();
      return;
    }
    if (!d.open) return;
    if (reducedMotion()) {
      d.close();
      return;
    }
    d.dataset.closing = ""; // play the fade-out, then really close
    const t = setTimeout(() => {
      delete d.dataset.closing;
      d.close();
    }, CLOSE_MS);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx(
        "m-auto max-h-[calc(100vh-48px)] w-[min(520px,calc(100vw-32px))] rounded-lg p-0 text-ink shadow-lg backdrop:frosted",
        OPENING,
        CLOSING,
        special
          ? cx(
              "special-border border-2 [&[open]:not([data-closing])]:animate-dialog-in-flow [&[open][data-closing]]:animate-dialog-out-flow",
              GLOW[glow],
            )
          : cx(
              "border border-line bg-sheet [&[open][data-closing]]:animate-dialog-out",
              shake
                ? "[&[open]:not([data-closing])]:animate-dialog-shake"
                : "[&[open]:not([data-closing])]:animate-dialog-in",
            ),
      )}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }} // Esc
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }} // click on the backdrop
    >
      <div className="flex items-center gap-3 px-5 pt-[18px]">
        {special && <SparkleBadge />}
        <Heading level={2} id={titleId} special={special} className="min-w-0 flex-1 text-[1.25rem]">
          {title}
        </Heading>
        <IconButton label="Close" onClick={onClose}>
          <IconX />
        </IconButton>
      </div>
      <div className="grid gap-3 px-5 pt-3.5 pb-[18px]">{txt(children)}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2.5 border-t border-line-2 px-5 py-3.5">{footer}</div>}
    </dialog>
  );
}
