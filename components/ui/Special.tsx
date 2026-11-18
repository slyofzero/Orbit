// "Special" = the animated gradient treatment for things that deserve attention
// (a milestone, a perfect score, a new feature). Use sparingly: one or two per screen.
// Larger components (card, callout, dialog, question, toast) also show this sparkle badge.
// The gradient itself is the `special-*` utilities in app/site.css.

import { IconSparkle } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";

/** The gradient square with a twinkling star. `small` = the size used inside callouts. */
export function SparkleBadge({ small = false, className }: { small?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "special-fill inline-grid shrink-0 animate-flow place-items-center rounded-[9px] shadow-[0_6px_16px_-8px_var(--special-c)] [&_svg]:size-[17px] [&_svg]:animate-twinkle [&_svg]:text-white",
        small ? "size-[26px]" : "size-[30px]",
        className,
      )}
    >
      <IconSparkle />
    </span>
  );
}

/** Is this item special? `special` may be true (all items), a list of item values, or nothing. */
export function isSpecial<V>(special: boolean | readonly V[] | undefined, value: V): boolean {
  return special === true || (Array.isArray(special) && special.includes(value));
}

/** Switches every "special" thing inside it from the cool gradient (teal, blue, violet) to the
 *  warm one (red, red-orange, amber-orange). Adds no box of its own (display: contents). */
export function Warm({ children, inline = false }: { children: React.ReactNode; inline?: boolean }) {
  const Tag = inline ? "span" : "div";
  return <Tag className="warm contents">{children}</Tag>;
}
