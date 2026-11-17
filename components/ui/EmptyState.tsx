import type { ReactNode } from "react";
import { txt } from "./txt";
import { Heading } from "./Heading";

/** What a list or page shows when it has nothing yet: say why, and offer the next step. */
export function EmptyState({ icon = "🪐", title, children, action }: {
  icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      <span className="ui-empty-icon" aria-hidden="true">{icon}</span>
      <Heading level={3}>{title}</Heading>
      {children && <p>{txt(children)}</p>}
      {action}
    </div>
  );
}
