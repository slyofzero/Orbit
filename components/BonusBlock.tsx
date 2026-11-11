"use client";
import Link from "next/link";
import Rich from "@/components/Rich";
import { bonusFor } from "@/lib/bonus";
import { Links } from "@/lib/links";
import { fmtDate, todayIST } from "@/lib/plan";
import { KEYS, usePack, usePersisted, usePlan } from "@/lib/store";
import { PracticeRec } from "@/lib/types";

// Pending work carried over from earlier days, shown as an extra on this day. It never counts towards finishing the day.
export default function BonusBlock({ date }: { date: string }) {
  const { plan } = usePlan();
  const { pack } = usePack();
  const [done, setDone] = usePersisted<Record<string, boolean>>(KEYS.done, {});
  const [links] = usePersisted<Links>(KEYS.links, {});
  const [practice] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const b = bonusFor(date, plan.days, done, links, pack, practice, todayIST());
  if (!b.tasks.length && !b.qs.length) return null;
  return (
    <div className="pl-bonus">
      <b className="pl-bonus-h">Bonus <span className="small muted">carried over from {b.from.map(fmtDate).join(", ")}</span></b>
      {b.tasks.map((t) => (
        <label key={`${t.from}:${t.idx}`} className="task bonus">
          <input type="checkbox" checked={false} onChange={() => setDone((p) => ({ ...p, [`${t.from}:${t.idx}`]: true }))} />
          <span><Rich text={t.text} /> <span className="pill bonus-pill">from {fmtDate(t.from)}</span></span>
        </label>
      ))}
      {b.qs.length > 0 && (
        <div className="row" style={{ marginTop: 6 }}>
          <span className="small">{b.qs.length} bonus question{b.qs.length === 1 ? "" : "s"}</span>
          <Link className="btn soft" href={`/day/${date}`}>Practise them</Link>
        </div>
      )}
    </div>
  );
}
