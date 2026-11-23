import type { ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { GLOW, SparkleBadge, type Glow } from "@/components/ui/Special";
import { txt } from "@/components/utils/txt";
import { Heading } from "@/components/ui/Heading";

/** A white sheet. `hero` = the dark navy panel (at most one per screen).
 *  `special` = animated gradient border and a sparkle badge; `glow` = how strongly it glows (low · medium · high).
 *  `onClick` = the whole card is one button (v1's pk-card): it lifts and its border turns accent on hover, and
 *  Tab / Enter / Space work. Don't put other buttons inside a clickable card. */
export function Card({
  title,
  subtitle,
  actions,
  hero = false,
  special = false,
  glow = "medium",
  className,
  onClick,
  label,
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
  /** makes the whole card one button */
  onClick?: () => void;
  /** clickable cards: what the click does, read out by screen readers (e.g. "Open Mock 1") */
  label?: string;
  children?: ReactNode;
}) {
  return (
    <section
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? label : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
              e.preventDefault();
              onClick();
            }
          : undefined
      }
      className={cx(
        "relative rounded-lg px-[22px] py-5",
        special
          ? cx("special-border animate-flow-border border-2", GLOW[glow])
          : hero
            ? "border border-hero bg-hero/80 text-on-hero glass-blur"
            : "glass-card border border-line",
        onClick &&
          "cursor-pointer transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_8px_22px_rgba(0,0,0,0.12)] focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
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
