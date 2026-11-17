import type { ReactNode } from "react";
import { cx } from "./cx";
import { SparkleBadge } from "./Special";
import { txt } from "./txt";
import { Heading } from "./Heading";

/** A white sheet. `hero` = the dark navy panel (at most one per screen).
 *  `special` = animated gradient border and a sparkle badge. */
export function Card({ title, subtitle, actions, hero = false, special = false, className, children }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; hero?: boolean; special?: boolean; className?: string; children?: ReactNode;
}) {
  return (
    <section className={cx("ui-card", hero && "ui-card-hero", special && "is-special", className)}>
      {(title || actions || special) && (
        <header className="ui-card-head">
          {special && <SparkleBadge />}
          <div className="ui-card-titles">
            {title && <Heading level={3} special={special}>{title}</Heading>}
            {subtitle && <p className="ui-card-sub">{txt(subtitle)}</p>}
          </div>
          {actions}
        </header>
      )}
      {txt(children)}
    </section>
  );
}
