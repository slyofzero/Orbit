import { fmtDate } from "@/lib/plan";

type Prac = Record<string, unknown>;

/** Progress for a day's own questions (the usual gradient) followed by a golden stretch for bonus questions carried over from earlier days. */
export function MainBar({ own, bonus, practice }: { own: string[]; bonus: { id: string }[]; practice: Prac }) {
  const total = own.length + bonus.length;
  if (total === 0) return null;
  const ownDone = own.filter((id) => practice[id]).length;
  const bonusDone = bonus.filter((b) => practice[b.id]).length;
  return (
    <div className="bar mbar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={ownDone + bonusDone}
      aria-label={`${ownDone + bonusDone} of ${total} answered${bonus.length ? `, including ${bonusDone} of ${bonus.length} bonus` : ""}`}>
      {own.length > 0 && <span className="mbar-own" style={{ flex: own.length }}><div style={{ width: `${(ownDone / own.length) * 100}%` }} /></span>}
      {bonus.length > 0 && <span className="mbar-bonus" style={{ flex: bonus.length }}><div style={{ width: `${(bonusDone / bonus.length) * 100}%` }} /></span>}
    </div>
  );
}

/** "Plus 2 bonus questions carried over from 12 Nov (1 solved)", or nothing when there are none. */
export function bonusLine(bonus: { id: string; from: string }[], practice: Prac): string {
  if (!bonus.length) return "";
  const from = [...new Set(bonus.map((b) => b.from))].map(fmtDate).join(", ");
  const solved = bonus.filter((b) => practice[b.id]).length;
  return `Plus ${bonus.length} bonus question${bonus.length === 1 ? "" : "s"} carried over from ${from} (${solved} solved)`;
}
