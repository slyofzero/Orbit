// v1's date block (planner cards and rows): a big day number over a small weekday on a soft tile.
// `highlight` = the focus day (yellow tile); `strike` = a past day, crossed out.

import type { ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { txt } from "@/components/utils/txt";

export function DateTile({
  big,
  small,
  size = "md",
  highlight = false,
  strike = false,
  className,
}: {
  /** e.g. "21" */
  big: ReactNode;
  /** e.g. "Sat" */
  small?: ReactNode;
  size?: "sm" | "md";
  highlight?: boolean;
  strike?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 flex-col items-center rounded-[14px] leading-none",
        size === "sm" ? "min-w-[42px] px-1 py-[5px]" : "min-w-[52px] px-1.5 py-2",
        highlight ? "bg-hi text-black" : "bg-sheet-2/70 text-ink",
        className,
      )}
    >
      <b
        className={cx(
          "font-display font-extrabold tabular-nums",
          size === "sm" ? "text-[1.15rem]" : "text-[1.6rem]",
          strike && "line-through decoration-[1.5px]",
        )}
      >
        {txt(big)}
      </b>
      {small && (
        <small className={cx("mt-[3px] text-[0.72rem] font-bold", highlight ? "text-black" : "text-gray")}>
          {txt(small)}
        </small>
      )}
    </span>
  );
}
