// Class lists shared by several components, so the same look is written once.
// (Plain strings: Tailwind finds the class names here like anywhere else.)
import { cx } from "@/components/ui/cx";

/** The frame of any field: border, background, hover, focus ring, disabled, and a red border when aria-invalid. */
export const FIELD_FRAME =
  "rounded-md border-[1.5px] border-line bg-sheet transition-[border-color,box-shadow] duration-150 hover:border-gray focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-red";

/** A text input or text area. */
export const FIELD_BOX = cx(FIELD_FRAME, "w-full px-3.5 py-2.5 font-body text-base text-ink");

/** The button that opens a pop-up (date picker, dropdown). `open` gives it the focus ring. */
export function triggerClass({
  open,
  empty,
  size = "md",
}: {
  open: boolean;
  empty: boolean;
  size?: "sm" | "md";
}): string {
  return cx(
    FIELD_FRAME,
    "flex w-full cursor-pointer items-center justify-between gap-2.5 text-left font-body",
    size === "sm" ? "px-3 py-1.5 text-[0.9rem]" : "px-3.5 py-2.5 text-base",
    empty ? "text-gray" : "text-ink",
    open && "border-accent shadow-[0_0_0_3px_var(--accent-soft)]",
  );
}
/** The chevron / calendar icon at the trigger's right end. */
export const triggerIconClass = (flipped = false) =>
  cx("size-[18px] shrink-0 text-gray transition-transform duration-150", flipped && "rotate-180");

/** A pop-up panel under its trigger (date picker, dropdown). */
export const POPUP =
  "absolute top-[calc(100%+6px)] left-0 z-30 animate-pop-in rounded-lg border border-line bg-sheet shadow-lg";

/** Label, hint and error text around a field. */
export const LABEL = "text-[0.92rem] font-bold";
export const HINT = "text-[0.85rem] text-gray";
export const ERROR = "text-[0.85rem] font-bold text-red";
