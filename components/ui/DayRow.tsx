"use client";
// v1's planner row: a date tile, the day's title, something at the end (a kind pill) and a count; a click
// opens the day's body below. The body is only rendered while open, so a long list stays cheap.
// `today` = accent border · `tone` won = green edge and tint, missed = red edge · `past` = faded and
// crossed out until opened or hovered.

import { useId, useState, type ReactNode } from "react";
import { DateTile } from "@/components/ui/DateTile";
import { cx } from "@/components/utils/cx";
import { txt } from "@/components/utils/txt";

export type DayRowTone = "won" | "missed";

export function DayRow({
  lead,
  title,
  end,
  count,
  today = false,
  past = false,
  tone,
  defaultOpen = false,
  children,
}: {
  /** the date tile, e.g. { big: "21", small: "Sat" } */
  lead: { big: ReactNode; small?: ReactNode };
  title: ReactNode;
  /** shown before the count; hidden on narrow phones */
  end?: ReactNode;
  /** e.g. "2/5" or "✓" */
  count?: ReactNode;
  today?: boolean;
  past?: boolean;
  tone?: DayRowTone;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const faded = past && !open;
  return (
    <div
      className={cx(
        "rounded-[14px] border transition-[border-color,background-color,opacity] duration-200",
        today ? "border-accent" : "border-transparent",
        tone === "won"
          ? "bg-[color-mix(in_srgb,var(--green)_7%,var(--sheet-2))] shadow-[inset_3px_0_0_var(--green)]"
          : "bg-sheet-2",
        tone === "missed" && "shadow-[inset_3px_0_0_var(--red)]",
        faded && "opacity-50 hover:opacity-100",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] border-0 bg-transparent px-3 py-2 text-left font-body text-ink hover:bg-accent/8"
      >
        <DateTile size="sm" big={lead.big} small={lead.small} strike={faded} />
        <span className={cx("min-w-0 flex-1 font-semibold", faded && "line-through decoration-[1.5px]")}>
          {txt(title)}
        </span>
        {end && <span className="flex items-center gap-2 max-[560px]:hidden">{end}</span>}
        {count !== undefined && <span className="min-w-[34px] text-right text-[0.85rem] text-gray">{txt(count)}</span>}
      </button>
      {open && (
        <div id={bodyId} className="animate-card-in pt-1 pr-4 pb-3.5 pl-[66px] max-[560px]:pl-3.5">
          {children}
        </div>
      )}
    </div>
  );
}
