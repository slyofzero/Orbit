"use client";
import { useMemo, useState, type ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { txt } from "@/components/utils/txt";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Give a sort value to make the column sortable (click the header). */
  sortValue?: (row: T) => number | string;
  /** Highlight the whole column with the animated gradient. */
  special?: boolean;
};

/** A data table. Scrolls sideways on narrow screens. Keep `rows` to one page (≤ a few hundred).
 *  `specialRow` highlights the rows it returns true for (e.g. your best topic). `rowHref` makes a row open that
 *  address in a new tab when clicked (or Enter on the focused row); clicks on a button or link inside it don't.
 *  `groupBy` draws a heavier line wherever the group changes from one row to the next (e.g. tasks of one day).
 *  `rowTone` tints a whole row green or red (e.g. done / missed), the same colours as the Topics progress rows. */
export function Table<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing here yet.",
  caption,
  specialRow,
  rowHref,
  groupBy,
  rowTone,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: ReactNode;
  caption?: string;
  specialRow?: (row: T) => boolean;
  rowHref?: (row: T) => string | null;
  groupBy?: (row: T) => string | number;
  rowTone?: (row: T) => "green" | "red" | null;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = get(a),
        y = get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  const cellClass = (c: Column<T>, head = false) =>
    cx(
      "border-b border-line-2 px-3.5 py-[11px] align-top",
      c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : "text-left",
      head && "sticky top-0 bg-sheet text-[0.82rem] font-bold whitespace-nowrap text-gray",
      head && c.special && "shadow-[inset_0_-2px_0_var(--special-b)]",
      !head && c.special && "bg-linear-to-b from-special-a/9 to-special-c/9 font-bold",
    );

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-sheet">
      <table className="w-full border-collapse text-[0.95rem]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const dir = sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined;
              const head = c.special ? (
                <span className="special-text animate-flow">{txt(c.header)}</span>
              ) : (
                txt(c.header)
              );
              return (
                <th key={c.key} className={cellClass(c, true)} aria-sort={c.sortValue ? (dir ?? "none") : undefined}>
                  {c.sortValue ? (
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-ink data-dir:text-ink"
                      data-dir={dir}
                      onClick={() => toggle(c.key)}
                    >
                      {head}
                      <span aria-hidden="true">{dir === "ascending" ? "▲" : dir === "descending" ? "▼" : "↕"}</span>
                    </button>
                  ) : (
                    head
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td className="px-3.5 py-7 text-center text-gray" colSpan={columns.length}>
                {txt(empty)}
              </td>
            </tr>
          ) : (
            sorted.map((r, i) => {
              const tone = rowTone?.(r) ?? null;
              const newGroup = !!groupBy && i > 0 && groupBy(r) !== groupBy(sorted[i - 1]);
              const href = rowHref?.(r) ?? null;
              const open = () => href && window.open(href, "_blank", "noopener");
              return (
                <tr
                  key={rowKey(r)}
                  tabIndex={href ? 0 : undefined}
                  title={href ? "Opens in a new tab" : undefined}
                  onClick={
                    href
                      ? (e) => {
                          // a button, link or field inside the row does its own thing
                          if ((e.target as HTMLElement).closest("button, a, input, textarea, [role=button]")) return;
                          open();
                        }
                      : undefined
                  }
                  onKeyDown={
                    href
                      ? (e) => {
                          if (e.key === "Enter" && e.target === e.currentTarget) open();
                        }
                      : undefined
                  }
                  className={cx(
                    "[&:last-child>td]:border-b-0",
                    tone === "green"
                      ? "bg-green/20 hover:bg-green/30"
                      : tone === "red"
                        ? "bg-red/20 hover:bg-red/30"
                        : "hover:bg-sheet-2",
                    newGroup && "[&>td]:border-t-2 [&>td]:border-t-line",
                    href &&
                      "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    specialRow?.(r) &&
                      "special-tint animate-flow [&>td:first-child]:font-bold [&>td:first-child]:shadow-[inset_3px_0_0_var(--special-b)]",
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cellClass(c)}>
                      {txt(c.cell(r))}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
