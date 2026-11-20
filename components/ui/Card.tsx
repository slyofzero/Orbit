import type { ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { SparkleBadge } from "@/components/ui/Special";
import { txt } from "@/components/utils/txt";
import { Heading } from "@/components/ui/Heading";

/** A white sheet. `hero` = the dark navy panel (at most one per screen).
 *  `special` = animated gradient border and a sparkle badge. */
export function Card({
  title,
  subtitle,
  actions,
  hero = false,
  special = false,
  className,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  hero?: boolean;
  special?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={cx(
        "rounded-lg px-[22px] py-5",
        special
          ? "special-border animate-flow-border border-2 shadow-[0_14px_34px_-22px_var(--special-c)]"
          : hero
            ? "border border-hero bg-hero text-on-hero"
            : "border border-line bg-sheet",
        className,
      )}
    >
      {(title || actions || special) && (
        <header className="mb-3.5 flex flex-wrap items-center gap-3">
          {special && <SparkleBadge />}
          <div className="min-w-0 flex-1">
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
