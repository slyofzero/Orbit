// "Special" = the animated gradient treatment for things that deserve attention
// (a milestone, a perfect score, a new feature). Use sparingly: one or two per screen.
// Larger components (card, callout, dialog, question, toast) also show this sparkle badge.

import { IconSparkle } from "./icons";
import { cx } from "./cx";

export function SparkleBadge({ className }: { className?: string }) {
  return <span className={cx("ui-sparkle", className)} aria-hidden="true"><IconSparkle /></span>;
}

/** Is this item special? `special` may be true (all items), a list of item values, or nothing. */
export function isSpecial<V>(special: boolean | readonly V[] | undefined, value: V): boolean {
  return special === true || (Array.isArray(special) && special.includes(value));
}

/** Switches every "special" thing inside it from the cool gradient (teal, blue, violet) to the
 *  warm one (red, red-orange, amber-orange). Adds no box of its own (display: contents). */
export function Warm({ children, inline = false }: { children: React.ReactNode; inline?: boolean }) {
  const Tag = inline ? "span" : "div";
  return <Tag className="ui-warm ui-warm-wrap">{children}</Tag>;
}
