import type { ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { GLOW, SparkleBadge, type Glow } from "@/components/ui/Special";
import { txt } from "@/components/utils/txt";
import { Heading } from "@/components/ui/Heading";

/** A white sheet. `hero` = the dark navy panel (at most one per screen).
 *  `special` = animated gradient border and a sparkle badge; `glow` = how strongly it glows (low · medium · high). */
export function Card({
  title,
  subtitle,
  actions,
  hero = false,
  special = false,
  glow = "medium",
  className,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  hero?: boolean;
  special?: boolean;
  /** special only: how strongly it glows (default medium) */
  glow?: Glow;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={cx(
        "rounded-lg px-[22px] py-5",
        special
          ? cx("special-border animate-flow-border border-2", GLOW[glow])
          : hero
            ? "border border-hero bg-hero text-on-hero"
            : "border border-line bg-sheet",
        className,
      )}
    >
      {(title || actions || special) && (
        <header className="mb-3.5 flex flex-wrap items-center gap-3">
          {special && <SparkleBadge />}
          <div className="min-w-0 flex-[1_1_260px]">
            {title && (
              <Heading level={2} special={special}>
                {title}
              </Heading>
            )}
            {subtitle && <p className={cx("mt-1", hero ? "text-on-hero/70" : "text-gray")}>{txt(subtitle)}</p>}
          </div>
          {actions}
        </header>
      )}
      {txt(children)}
    </section>
  );
}
