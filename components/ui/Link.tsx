import NextLink from "next/link";
import type { ReactNode } from "react";
import { txt } from "./txt";
import { cx } from "./cx";

export type LinkVariant = "inline" | "nav" | "subtle";

/** A link. Addresses starting with http(s) or mailto open in a new tab; everything else is an
 *  in-app link (Next.js, no page reload). inline = underlined in running text · nav = menu item ·
 *  subtle = quiet, underlines on hover. `active` marks the current menu item. */
export function Link({ href, variant = "inline", active = false, className, children }: {
  href: string; variant?: LinkVariant; active?: boolean; className?: string; children: ReactNode;
}) {
  const cls = cx("ui-link", `ui-link-${variant}`, active && "is-active", className);
  if (/^(https?:|mailto:)/i.test(href)) {
    return <a href={href} className={cls} target="_blank" rel="noopener noreferrer">{txt(children)}</a>;
  }
  if (href.startsWith("#")) return <a href={href} className={cls}>{txt(children)}</a>;
  return <NextLink href={href} className={cls} aria-current={active ? "page" : undefined}>{txt(children)}</NextLink>;
}
