import type { ReactNode } from "react";
import { Rich } from "./Rich";
import { txt } from "./txt";
import { cx } from "./cx";

export type TextVariant = "body" | "muted" | "small" | "hint" | "caption" | "error";

const VARIANT: Record<TextVariant, string> = {
  body: "text-ink",
  muted: "text-gray",
  small: "text-sm text-ink-2",
  hint: "text-[0.85rem] text-gray",
  caption: "block text-[0.78rem] font-bold tracking-[0.04em] text-gray uppercase",
  error: "text-[0.85rem] font-bold text-red",
};

/** Running text. Renders markdown + maths.
 *  body = normal reading text · muted = quieter · small = smaller · hint = help under a field ·
 *  caption = small uppercase label above a group · error = what went wrong.
 *  `block` = full markdown (paragraphs, lists…); needs a string. */
export function Text({
  variant = "body",
  as = "p",
  block = false,
  className,
  children,
}: {
  variant?: TextVariant;
  as?: "p" | "span" | "div";
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const cls = cx(VARIANT[variant], className);
  if (block && typeof children === "string") return <Rich text={children} block className={cls} />;
  const Tag = as;
  return <Tag className={cls}>{txt(children)}</Tag>;
}

/** Inline code: shown exactly as written (no markdown or maths inside). */
export function Code({ children }: { children: string }) {
  return (
    <code className="rounded-[6px] bg-sheet-2 px-[7px] py-0.5 font-mono text-[0.88em] whitespace-pre-wrap text-ink-2 wrap-anywhere">
      {children}
    </code>
  );
}
