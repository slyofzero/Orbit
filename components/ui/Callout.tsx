import type { ReactNode } from "react";
import { SparkleBadge } from "./Special";
import { txt } from "./txt";

export type CalloutTone = "info" | "success" | "warn" | "caution" | "special";

const ICON: Record<Exclude<CalloutTone, "special">, string> = { info: "ℹ️", success: "✅", warn: "⚠️", caution: "🔴" };

/** A highlighted message. `caution` is for anything destructive or that the user must NOT do;
 *  its title always starts with "CAUTION:". `special` = animated gradient border + sparkle, for good news. */
export function Callout({ tone = "info", title, children }: { tone?: CalloutTone; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`ui-callout ui-callout-${tone}`} role={tone === "caution" ? "alert" : "note"}>
      {tone === "special" ? <SparkleBadge /> : <span className="ui-callout-icon" aria-hidden="true">{ICON[tone]}</span>}
      <div className="ui-callout-body">
        {(title || tone === "caution") && (
          <span className="ui-callout-title">{tone === "caution" ? <>CAUTION: {txt(title)}</> : txt(title)}</span>
        )}
        {children && <div>{txt(children)}</div>}
      </div>
    </div>
  );
}
