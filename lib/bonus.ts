import type { Day } from "./types";
import type { PackData } from "./packs";
import { liveQuestionIds, Links } from "./links";

export type BonusTask = { from: string; idx: number; text: string };
export type Bonus = { tasks: BonusTask[]; qs: { id: string; from: string }[]; from: string[] };
export const NO_BONUS: Bonus = { tasks: [], qs: [], from: [] };
export const BONUS_DAYS = 3;

/**
 * Bonus work on a day: the tasks and linked questions still pending on a day that has started (today or earlier) are spread over that day's next 3 plan days.
 * The split follows each item's fixed position (task number, link order), not the number still pending, so an item never jumps day when you finish another one.
 * Nothing is stored: ticking the task or answering the question on its original day or here clears it everywhere.
 */
export function bonusFor(date: string, days: Day[], done: Record<string, boolean>, links: Links, pack: PackData, practice: Record<string, unknown>, today: string): Bonus {
  if (date < today) return NO_BONUS;
  const own = new Set(liveQuestionIds(links[date], pack).ids);
  const out: Bonus = { tasks: [], qs: [], from: [] };
  for (const src of days) {
    if (src.date > today || src.date === date) continue;
    const next = days.filter((x) => x.date > src.date && x.kind !== "exam").slice(0, BONUS_DAYS);
    const slot = next.findIndex((x) => x.date === date);
    if (slot < 0) continue;
    const n = next.length;
    let any = false;
    src.tasks.forEach((text, idx) => {
      if (idx % n === slot && !done[`${src.date}:${idx}`]) { out.tasks.push({ from: src.date, idx, text }); any = true; }
    });
    const live = liveQuestionIds(links[src.date], pack).ids;
    live.forEach((id, p) => {
      if (Math.floor((p * n) / live.length) === slot && !practice[id] && !own.has(id)) { out.qs.push({ id, from: src.date }); any = true; }
    });
    if (any) out.from.push(src.date);
  }
  return out;
}
