import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { SparkleBadge } from "@/components/ui/Special";
import { txt } from "@/components/ui/txt";

export type CalloutTone = "info" | "success" | "warn" | "caution" | "special";

const ICON: Record<Exclude<CalloutTone, "special">, string> = { info: "ℹ️", success: "✅", warn: "⚠️", caution: "🔴" };
const TONE: Record<CalloutTone, string> = {
  info: "border-[1.5px] border-blue bg-blue-soft",
  success: "border-[1.5px] border-green bg-green-soft",
  warn: "border-[1.5px] border-hi bg-hi-soft",
  caution: "border-[1.5px] border-red bg-red-soft",
  special:
    "special-border animate-flow-border border-2 [--sp-inner:color-mix(in_srgb,var(--special-b)_7%,var(--sheet))]",
};

/** A highlighted message. `caution` is for anything destructive or that the user must NOT do;
 *  its title always starts with "CAUTION:". `special` = animated gradient border + sparkle, for good news. */
export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cx("flex items-start gap-3 rounded-md px-4 py-3", TONE[tone])}
      role={tone === "caution" ? "alert" : "note"}
    >
      {tone === "special" ? (
        <SparkleBadge small />
      ) : (
        <span className="shrink-0 text-[1.1rem] leading-[1.4]" aria-hidden="true">
          {ICON[tone]}
        </span>
      )}
      <div className="grid min-w-0 gap-0.5">
        {(title || tone === "caution") && (
          <span className={cx("font-bold", tone === "caution" && "text-red")}>
            {tone === "caution" ? <>CAUTION: {txt(title)}</> : txt(title)}
          </span>
        )}
        {children && <div>{txt(children)}</div>}
      </div>
    </div>
  );
}
