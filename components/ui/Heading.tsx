import type { ReactNode } from "react";
import { cx } from "./cx";
import { txt } from "./txt";

/** A heading. `special` paints it with the animated gradient. */
export function Heading({ level = 2, special = false, id, className, children }: {
  level?: 1 | 2 | 3; special?: boolean; id?: string; className?: string; children: ReactNode;
}) {
  const H = (["h1", "h2", "h3"] as const)[level - 1];
  return <H id={id} className={cx(special && "ui-special-text", className)}>{txt(children)}</H>;
}
