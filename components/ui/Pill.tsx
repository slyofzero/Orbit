import type { ReactNode } from "react";
import { txt } from "./txt";

export type PillTone = "neutral" | "accent" | "green" | "red" | "amber" | "blue" | "ink" | "special";

/** Small rounded label: status, difficulty, counts, tags. `special` = animated gradient. */
export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`ui-pill ui-pill-${tone}`}>{txt(children)}</span>;
}

/** A keyboard key, e.g. <Kbd>Esc</Kbd>. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ui-kbd">{children}</kbd>;
}
