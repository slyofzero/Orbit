import NextLink from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { txt } from "@/components/utils/txt";

export type StatusTone = "green" | "amber" | "red";

const DOT: Record<StatusTone, string> = { green: "bg-green", amber: "bg-amber", red: "bg-red" };

/** A small coloured dot (v1's topic rating: red new to you, amber shaky, green solid). `label` is read aloud
 *  and shown on hover. */
export function StatusDot({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cx("block size-2.5 shrink-0 rounded-full", DOT[tone])}
    />
  );
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** v1's practice row: a lead (usually a `StatusDot`), a title, and a short `end` text. The row is its own
 *  progress bar: `good` percent of its width is tinted green, then `bad` percent red, then `skipped` percent grey
 *  (e.g. opened but never answered); the rest stays plain. `href` makes it a link, otherwise `onClick` makes it a
 *  button. `hint` is the hover text. */
export function ProgressRow({
  lead,
  title,
  end,
  good = 0,
  bad = 0,
  skipped = 0,
  hint,
  href,
  onClick,
  className,
}: {
  lead?: ReactNode;
  title: ReactNode;
  end?: ReactNode;
  good?: number; // 0-100: share tinted green
  bad?: number; // 0-100: share tinted red, after the green
  skipped?: number; // 0-100: share tinted grey, after the red
  hint?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const ok = clamp(good);
  const wrong = clamp(ok + bad);
  const skip = clamp(wrong + skipped);
  const style: CSSProperties | undefined =
    skip > 0
      ? {
          backgroundImage: `linear-gradient(90deg, color-mix(in srgb, var(--green) 30%, transparent) ${ok}%, color-mix(in srgb, var(--red) 30%, transparent) ${ok}% ${wrong}%, color-mix(in srgb, var(--gray) 22%, transparent) ${wrong}% ${skip}%, transparent ${skip}%)`,
        }
      : undefined;
  const cls = cx(
    "flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 text-left font-body text-ink no-underline transition-colors duration-150 hover:bg-sheet-2",
    className,
  );
  const inner = (
    <>
      {lead}
      <span className="min-w-0 flex-1 leading-[1.3] font-semibold">{txt(title)}</span>
      {end && <span className="shrink-0 text-[0.85rem] text-gray">{txt(end)}</span>}
    </>
  );
  if (href)
    return (
      <NextLink href={href} className={cls} style={style} title={hint}>
        {inner}
      </NextLink>
    );
  return (
    <button type="button" className={cls} style={style} title={hint} onClick={onClick}>
      {inner}
    </button>
  );
}
