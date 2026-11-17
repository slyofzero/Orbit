import type { ReactNode } from "react";
import { IconChevronRight } from "./icons";
import { txt } from "./txt";
import { cx } from "./cx";

/** Show / hide extra content (help, advanced options). Built on <details>, so it works without JS. */
export function Disclosure({ title, defaultOpen = false, className, children }: {
  title: ReactNode; defaultOpen?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <details className={cx("ui-disc", className)} open={defaultOpen || undefined}>
      <summary className="ui-disc-sum"><IconChevronRight className="ui-disc-chev" />{txt(title)}</summary>
      <div className="ui-disc-body">{children}</div>
    </details>
  );
}
