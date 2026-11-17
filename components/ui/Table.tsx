"use client";
import { useMemo, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { txt } from "./txt";

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
 *  `specialRow` highlights the rows it returns true for (e.g. your best topic). */
export function Table<T>({ columns, rows, rowKey, empty = "Nothing here yet.", caption, specialRow }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string | number; empty?: ReactNode; caption?: string;
  specialRow?: (row: T) => boolean;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  const cellClass = (c: Column<T>) =>
    cx(c.align === "right" && "is-right", c.align === "center" && "is-center", c.special && "is-special-col") || undefined;

  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        {caption && <caption className="ui-sr">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const dir = sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined;
              const head = c.special ? <span className="ui-special-text">{txt(c.header)}</span> : txt(c.header);
              return (
                <th key={c.key} className={cellClass(c)} aria-sort={c.sortValue ? dir ?? "none" : undefined}>
                  {c.sortValue ? (
                    <button type="button" className="ui-table-sort" data-dir={dir} onClick={() => toggle(c.key)}>
                      {head}<span aria-hidden="true">{dir === "ascending" ? "▲" : dir === "descending" ? "▼" : "↕"}</span>
                    </button>
                  ) : head}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td className="ui-table-empty" colSpan={columns.length}>{txt(empty)}</td></tr>
          ) : sorted.map((r) => (
            <tr key={rowKey(r)} className={specialRow?.(r) ? "is-special-row" : undefined}>
              {columns.map((c) => <td key={c.key} className={cellClass(c)}>{txt(c.cell(r))}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
