import type { ReactNode } from "react";
import { txt } from "./txt";
import { cx } from "./cx";

export type DividerVariant = "solid" | "dashed" | "dotted" | "double" | "thick" | "accent" | "fade" | "special";

// The line is drawn by ::before (and ::after when there is a label). Each variant styles both.
const LINE: Record<Exclude<DividerVariant, "fade">, string> = {
  solid: "before:border-t after:border-t before:border-line after:border-line",
  dashed:
    "before:border-t-[1.5px] after:border-t-[1.5px] before:border-dashed after:border-dashed before:border-line after:border-line",
  dotted:
    "before:border-t-[3px] after:border-t-[3px] before:border-dotted after:border-dotted before:border-gray after:border-gray",
  double:
    "before:border-t-4 after:border-t-4 before:border-double after:border-double before:border-line after:border-line",
  thick: "text-ink before:h-[3px] after:h-[3px] before:rounded-[3px] after:rounded-[3px] before:bg-ink after:bg-ink",
  accent: "text-accent before:border-t-2 after:border-t-2 before:border-accent after:border-accent",
  special:
    "before:h-[3px] after:h-[3px] before:rounded-[3px] after:rounded-[3px] before:special-fill after:special-fill before:animate-flow after:animate-flow",
};
const FADE_LABELLED =
  "before:h-px after:h-px before:bg-linear-to-r before:from-transparent before:to-gray after:bg-linear-to-r after:from-gray after:to-transparent";
const FADE_ALONE = "before:h-px before:bg-linear-to-r before:from-transparent before:via-gray before:to-transparent";

/** A horizontal line between sections, optionally with a label in it ("or", "Week 2", …).
 *  `special` = animated gradient (cool by default; wrap in <Warm> for the warm one). */
export function Divider({
  variant = "solid",
  label,
  align = "center",
}: {
  variant?: DividerVariant;
  label?: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cx(
        "my-[18px] flex w-full items-center gap-3 font-body text-[0.78rem] font-bold tracking-[0.04em] text-gray uppercase",
        "before:min-w-3 before:flex-1 before:content-[''] after:min-w-3 after:flex-1 after:content-['']",
        !label && "after:hidden",
        !!label && align === "start" && "before:flex-[0_0_20px]",
        variant === "fade" ? (label ? FADE_LABELLED : FADE_ALONE) : LINE[variant],
      )}
    >
      {label && (
        <span className={cx("max-w-[70%] flex-none text-center", variant === "special" && "special-text animate-flow")}>
          {txt(label)}
        </span>
      )}
    </div>
  );
}
