// v1's list row ("Coming up"): a small lead block (a big number over a small word), a title, and something
// at the end (a pill, a count). With `href` or `onClick` the whole row is clickable and nudges right on hover.

import NextLink from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { txt } from "@/components/utils/txt";

const ROW =
  "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-[14px] border-0 bg-transparent px-2.5 py-[9px] text-left font-body text-ink no-underline transition-[background-color,transform] duration-200";
const LIVE = "cursor-pointer hover:translate-x-1 hover:bg-sheet-2";

export function ActionRow({
  lead,
  title,
  sub,
  end,
  href,
  onClick,
}: {
  /** e.g. { big: "21", small: "Sat" } */
  lead?: { big: ReactNode; small?: ReactNode };
  title: ReactNode;
  sub?: ReactNode;
  end?: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      {lead ? (
        <span className="grid min-w-[2.2rem] justify-items-center leading-none">
          <span className="font-display text-[1.35rem] font-extrabold tabular-nums">{txt(lead.big)}</span>
          {lead.small && <span className="mt-0.5 text-[0.74rem] text-gray">{txt(lead.small)}</span>}
        </span>
      ) : (
        <span />
      )}
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate font-semibold">{txt(title)}</span>
        {sub && <span className="truncate text-[0.85rem] text-gray">{txt(sub)}</span>}
      </span>
      <span className="flex items-center gap-2">{end}</span>
    </>
  );
  if (href)
    return (
      <NextLink href={href} className={cx(ROW, LIVE)}>
        {body}
      </NextLink>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cx(ROW, LIVE)}>
        {body}
      </button>
    );
  return <div className={ROW}>{body}</div>;
}
