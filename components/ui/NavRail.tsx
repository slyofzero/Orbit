"use client";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { txt } from "@/components/utils/txt";

export type NavItem = { href: string; label: string; icon: ReactNode };

/**
 * v1's main menu. Desktop: a narrow rail on the left (brand on top, icon-over-label items, `footer`
 * at the bottom). Phone (≤ 760px): a bar along the bottom of the screen, and the `footer` floats in
 * the top-right corner. The current page's item is tinted.
 */
export function NavRail({
  items,
  brand,
  stage,
  footer,
  className,
}: {
  items: NavItem[];
  brand?: { title: string; subtitle?: string; href: string };
  stage?: ReactNode; // e.g. <Companion />
  footer?: ReactNode; // e.g. <ThemeToggle compact />
  className?: string;
}) {
  const path = usePathname() ?? "";
  return (
    <nav
      aria-label="Main"
      className={cx(
        "glass-rail sticky top-0 z-30 flex h-screen flex-col items-center gap-1 border-r border-line px-2.5 pt-4 pb-3.5 shadow-card",
        "max-[760px]:fixed max-[760px]:inset-x-0 max-[760px]:top-auto max-[760px]:bottom-0 max-[760px]:z-40 max-[760px]:h-auto max-[760px]:flex-row max-[760px]:justify-around max-[760px]:border-t max-[760px]:border-r-0 max-[760px]:bg-sheet/70 max-[760px]:px-2 max-[760px]:pt-1.5 max-[760px]:pb-[calc(6px+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {brand && (
        <NextLink
          href={brand.href}
          className="mb-2.5 shrink-0 text-center font-display text-[1.15rem] leading-none font-extrabold tracking-[-0.02em] text-ink no-underline max-[760px]:hidden"
        >
          {txt(brand.title)}
          {brand.subtitle && (
            <small className="mt-[3px] block font-body text-[0.8rem] font-semibold text-gray">
              {txt(brand.subtitle)}
            </small>
          )}
        </NextLink>
      )}
      {items.map((it) => {
        const active = path === it.href || path.startsWith(it.href + "/");
        return (
          <NextLink
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group flex w-full shrink-0 flex-col items-center gap-[3px] rounded-[14px] px-1 py-[7px] text-[0.78rem] font-semibold no-underline transition-[background-color,color,transform] duration-200 hover:-translate-y-0.5",
              "max-[760px]:w-auto max-[760px]:flex-1 max-[760px]:px-0.5 max-[760px]:py-1.5",
              "[&_svg]:size-[22px] [&_svg]:transition-transform [&_svg]:duration-[250ms] [&_svg]:ease-[cubic-bezier(0.3,1.6,0.5,1)] hover:[&_svg]:scale-[1.12] hover:[&_svg]:-rotate-4",
              active
                ? "bg-accent-soft/75 text-accent [&_svg]:stroke-[2.1]"
                : "text-gray hover:bg-sheet-2/60 hover:text-ink",
            )}
          >
            {it.icon}
            {txt(it.label)}
          </NextLink>
        );
      })}
      {stage && <div className="my-2 flex min-h-0 w-full flex-1 flex-col max-[760px]:hidden">{stage}</div>}
      {footer && (
        <div
          className={cx(
            stage ? "mt-0" : "mt-auto",
            "shrink-0 max-[760px]:fixed max-[760px]:top-2.5 max-[760px]:right-3 max-[760px]:z-50 max-[760px]:mt-0",
          )}
        >
          {footer}
        </div>
      )}
    </nav>
  );
}
