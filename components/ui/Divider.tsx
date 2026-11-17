import type { ReactNode } from "react";
import { txt } from "./txt";
import { cx } from "./cx";

export type DividerVariant = "solid" | "dashed" | "dotted" | "double" | "thick" | "accent" | "fade" | "special";

/** A horizontal line between sections, optionally with a label in it ("or", "Week 2", …).
 *  `special` = animated gradient (cool by default; wrap in <Warm> for the warm one). */
export function Divider({ variant = "solid", label, align = "center" }: {
  variant?: DividerVariant; label?: ReactNode; align?: "center" | "start";
}) {
  return (
    <div role="separator" aria-orientation="horizontal"
      className={cx("ui-divider", `ui-divider-${variant}`, label ? "has-label" : null, label && align === "start" ? "is-start" : null)}>
      {label && <span className={variant === "special" ? "ui-special-text" : undefined}>{txt(label)}</span>}
    </div>
  );
}
