"use client";
import Link from "next/link";
import Rich from "@/components/Rich";
import { bonusFor, bonusQKey, bonusTaskKey } from "@/lib/bonus";
import { Links } from "@/lib/links";
import { isDayLocked, LOCK_MESSAGE, useLockClock } from "@/lib/lock";
import { fmtDate, todayIST } from "@/lib/plan";
import { KEYS, usePack, usePersisted, usePlan } from "@/lib/store";
import { toast } from "@/lib/toast";
import { PracticeRec } from "@/lib/types";

export const UnlinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71M8 2v3M2 8h3M16 22v-3M22 16h-3" /></svg>
);

// Pending work carried over from earlier days, shown as an extra on this day. Bonus tasks and questions must all be done for the day to count as solved (see dayWon in lib/bonus.ts).
// Either kind can be unlinked from this day (stored in KEYS.bonusOff). Today's bonus can't be unlinked after 9 AM, like the rest of today's plan.
export default function BonusBlock({ date }: { date: string }) {
  const { plan } = usePlan();
  const { pack } = usePack();
  const [done, setDone] = usePersisted<Record<string, boolean>>(KEYS.done, {});
  const [links] = usePersisted<Links>(KEYS.links, {});
  const [practice] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [off, setOff] = usePersisted<Record<string, boolean>>(KEYS.bonusOff, {});
  const locked = isDayLocked(date, useLockClock());
  const b = bonusFor(date, plan.days, done, links, pack, practice, todayIST(), off);
  if (!b.tasks.length && !b.qs.length) return null;
  const unlink = (keys: string[], what: string) => {
    if (locked) { toast(LOCK_MESSAGE, "warn"); return; }
    setOff((p) => ({ ...p, ...Object.fromEntries(keys.map((k) => [k, true])) }));
    toast(`${what} unlinked from this day`);
  };
  const tip = locked ? "Locked after 9 AM" : "";
  return (
    <div className="pl-bonus">
      <b className="pl-bonus-h">Bonus <span className="small muted">carried over from {b.from.map(fmtDate).join(", ")}</span></b>
      {b.tasks.map((t) => (
        <div key={`${t.from}:${t.idx}`} className="task bonus bo-row">
          <label className="bo-main">
            <input type="checkbox" checked={false} onChange={() => setDone((p) => ({ ...p, [`${t.from}:${t.idx}`]: true }))} />
            <span className="bo-txt"><span className="pill bonus-pill">from {fmtDate(t.from)}</span><span><Rich text={t.text} /></span></span>
          </label>
          <button className="bo-x" disabled={locked} data-tip={tip || "Unlink this bonus task"} aria-label="Unlink this bonus task" onClick={() => unlink([bonusTaskKey(t.from, t.idx)], "Bonus task")}><UnlinkIcon /></button>
        </div>
      ))}
      {b.qs.length > 0 && (
        <div className="row" style={{ marginTop: 6 }}>
          <span className="small">{b.qs.length} bonus question{b.qs.length === 1 ? "" : "s"}{b.qs.some((x) => practice[x.id]) ? `, ${b.qs.filter((x) => practice[x.id]).length} solved` : ""}</span>
          <Link className="btn soft" href={`/day/${date}`}>Practise them</Link>
          <button className="bo-x right" style={{ marginLeft: "auto" }} disabled={locked} data-tip={tip || "Unlink all bonus questions"} aria-label="Unlink all bonus questions" onClick={() => unlink(b.qs.map((x) => bonusQKey(x.from, x.id)), `${b.qs.length} bonus question${b.qs.length === 1 ? "" : "s"}`)}><UnlinkIcon /></button>
        </div>
      )}
    </div>
  );
}
