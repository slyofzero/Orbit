import NextLink from "next/link";
import type { ReactNode } from "react";
import { txt } from "@/components/utils/txt";
import { cx } from "@/components/utils/cx";

export type LinkVariant = "inline" | "nav" | "subtle";

const VARIANT: Record<LinkVariant, string> = {
  inline: "text-accent underline decoration-[1.5px] underline-offset-[3px] hover:text-ink",
  subtle: "text-ink-2 no-underline hover:text-accent hover:underline hover:underline-offset-[3px]",
  nav: "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[0.9rem] font-bold no-underline hover:bg-sheet-2 hover:text-ink",
};

/** A link. Addresses starting with http(s) or mailto open in a new tab; everything else is an
 *  in-app link (Next.js, no page reload). inline = underlined in running text · nav = menu item ·
 *  subtle = quiet, underlines on hover. `active` marks the current menu item. */
export function Link({
  href,
  variant = "inline",
  active = false,
  className,
  children,
}: {
  href: string;
  variant?: LinkVariant;
  active?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const cls = cx(
    "transition-colors duration-150",
    VARIANT[variant],
    variant === "nav" && (active ? "bg-accent-soft text-accent" : "text-gray"),
    className,
  );
  if (/^(https?:|mailto:)/i.test(href)) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {txt(children)}
      </a>
    );
  }
  if (href.startsWith("#"))
    return (
      <a href={href} className={cls}>
        {txt(children)}
      </a>
    );
  return (
    <NextLink href={href} className={cls} aria-current={active ? "page" : undefined}>
      {txt(children)}
    </NextLink>
  );
}
