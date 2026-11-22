// Carry-over (docs/PLANS.md §5), as pure functions: how a closed day's unfinished work is shared out over the
// next planned days. Nothing here is stored; lib/db/queries/carry.ts reads the days and calls these.

import { addDays, type IsoDate } from "@/lib/dates";

/** How many planned days after a day share its unfinished work. */
export const CARRY_DAYS = 3;

/** Where n items go over `slots` receiving days: back-to-back [start, end) chunks, earlier days get the extra
 *  item. 5 over 3 → [0,2) [2,4) [4,5). */
export function carryChunks(n: number, slots: number): [number, number][] {
  const k = Math.max(0, Math.min(CARRY_DAYS, Math.floor(slots)));
  const base = Math.floor(n / k);
  const extra = n % k;
  const out: [number, number][] = [];
  let start = 0;
  for (let j = 0; j < k; j++) {
    const size = base + (j < extra ? 1 : 0);
    out.push([start, start + size]);
    start += size;
  }
  return out;
}

/** The items the j-th planned day after the source day gets (j = 0 is the next one), out of `slots` days. */
export function carriedSlice<T>(items: readonly T[], slots: number, j: number): T[] {
  const chunk = carryChunks(items.length, slots)[j];
  return chunk ? items.slice(chunk[0], chunk[1]) : [];
}

/** A day is closed once its date is before today: its unfinished work carries over. */
export const isClosed = (date: IsoDate, today: IsoDate) => date < today;

/** When a day ends (IST midnight after it), in Unix ms: an item ticked at or after this was still pending. */
export const dayEnd = (date: IsoDate) => Date.parse(`${addDays(date, 1)}T00:00:00+05:30`);

/** Whether an item was still pending when its day ended: never ticked, or ticked after the day was over. */
export const pendingAtEnd = (doneAt: number | null, date: IsoDate) => doneAt === null || doneAt >= dayEnd(date);
