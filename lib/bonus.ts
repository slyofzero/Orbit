import type { Day } from "./types";
import type { PackData } from "./packs";
import { dayFinished, liveQuestionIds, Links } from "./links";
import { todayIST } from "./plan";

export type BonusTask = { from: string; idx: number; text: string };
export type Bonus = { tasks: BonusTask[]; qs: { id: string; from: string }[]; from: string[] };
export const NO_BONUS: Bonus = { tasks: [], qs: [], from: [] };
export const BONUS_DAYS = 3;

/**
 * Bonus work on a day: the tasks and linked questions still pending when a day has ENDED (any day before today) are spread over that day's next 3 plan days.
 * The split follows each item's fixed position (task number, link order), not the number still pending, so an item never jumps day when you finish another one.
 * A question stays on its new day once carried, even after you solve it here: it now belongs to that day. It only drops out if it was already answered before its original day ended.
 * Nothing is stored: ticking a task on its original day or here clears it everywhere.
 */
export function bonusFor(date: string, days: Day[], done: Record<string, boolean>, links: Links, pack: PackData, practice: Record<string, { at?: number } | undefined>, today: string): Bonus {
  if (date < today) return NO_BONUS;
  const own = new Set(liveQuestionIds(links[date], pack).ids);
  const out: Bonus = { tasks: [], qs: [], from: [] };
  for (const src of days) {
    if (src.date >= today || src.date === date) continue; // a day only carries work forward once it has ended
    const next = days.filter((x) => x.date > src.date && x.kind !== "exam").slice(0, BONUS_DAYS);
    const slot = next.findIndex((x) => x.date === date);
    if (slot < 0) continue;
    const n = next.length;
    let any = false;
    src.tasks.forEach((text, idx) => {
      if (idx % n === slot && !done[`${src.date}:${idx}`]) { out.tasks.push({ from: src.date, idx, text }); any = true; }
    });
    const ended = new Date(`${src.date}T00:00:00+05:30`).getTime() + 86400000; // when the source day finished
    const live = liveQuestionIds(links[src.date], pack).ids;
    live.forEach((id, p) => {
      if (Math.floor((p * n) / live.length) === slot && (!practice[id] || (practice[id]!.at ?? 0) >= ended) && !own.has(id)) { out.qs.push({ id, from: src.date }); any = true; }
    });
    if (any) out.from.push(src.date);
  }
  return out;
}

/** dayFinished, plus: bonus questions carried onto this day must be answered too. Without them the day is not fully solved. */
export function dayWon(day: Day | undefined, days: Day[], done: Record<string, boolean>, links: Links, pack: PackData, practice: Record<string, { at?: number } | undefined>): boolean {
  if (!day) return false;
  if (!dayFinished(day, done, links[day.date], pack, practice)) return false;
  return bonusFor(day.date, days, done, links, pack, practice, todayIST()).qs.every((b) => practice[b.id]);
}
