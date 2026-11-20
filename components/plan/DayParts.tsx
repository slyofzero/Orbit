"use client";
// Pieces of a plan day shared by the dashboard's agenda and the planner (v1): the day lock beside the
// day's name, the "main event" (the day's linked questions) and the bonus block (carried-over work).

import { Button, Checkbox, IconButton, Pill, ProgressBar, Text, Tooltip, type ProgressSegment } from "@/components/ui";
import { IconLock, IconLockOpen, IconUnlink } from "@/components/icons";
import { cx } from "@/components/utils/cx";
import { formatShort, type IsoDate } from "@/lib/dates";
import { LOCK_HOUR, dayLock } from "@/lib/dashboard";

/** One item carried over from an earlier day (docs/PLANS.md §5). */
export type BonusItem = { key: string; from: IsoDate; body: string; done: boolean };

/** v1's lock beside the day's name: green and open before LOCK_HOUR today, red and locked after (and on past days). */
export function DayLock({ date, today, hour }: { date: IsoDate; today: IsoDate; hour: number }) {
  const lock = dayLock(date, today, hour);
  if (lock === "free") return null;
  const tip =
    lock === "open"
      ? `**Today is open until ${LOCK_HOUR} AM.** After ${LOCK_HOUR} AM today's tasks and linked questions (including carried-over bonus work) can't be edited or unlinked. You can still tick tasks and solve questions. Tomorrow and later days stay editable.`
      : date === today
        ? `**Today is locked after ${LOCK_HOUR} AM**, so its tasks and linked questions can't be changed. You can still tick tasks and solve questions. Tomorrow and later days stay editable.`
        : "**This day is over**, so its tasks and linked questions can't be changed. You can still tick tasks and solve questions.";
  return (
    <Tooltip content={tip} placement="bottom">
      <span
        tabIndex={0}
        aria-label={lock === "open" ? "Today is open" : "Locked"}
        className={cx(
          "grid size-[30px] place-items-center rounded-full [&_svg]:size-4",
          lock === "open" ? "bg-green-soft text-green" : "bg-red-soft text-red",
        )}
      >
        {lock === "open" ? <IconLockOpen /> : <IconLock />}
      </span>
    </Tooltip>
  );
}

/** v1's "main event": the day's linked questions in a warm gradient frame; faded once all are answered.
 *  `onUnlink` adds v1's "Unlink this day" button (the planner shows it while the day isn't locked). */
export function MainEvent({
  date,
  total,
  answered,
  correct,
  bonus,
  onUnlink,
}: {
  date: IsoDate;
  total: number;
  answered: number;
  correct: number;
  bonus: { total: number; done: number }[];
  onUnlink?: () => void;
}) {
  const b = bonus.reduce((s, x) => ({ total: s.total + x.total, done: s.done + x.done }), { total: 0, done: 0 });
  const done = answered >= total && b.done >= b.total;
  const segments: ProgressSegment[] = [
    { value: answered, max: total, tone: "warm" },
    { value: b.done, max: b.total, tone: "gold" },
  ];
  return (
    <div
      className={cx(
        "warm special-border mt-3.5 rounded-[16px] border-2 px-4 py-3.5 shadow-[0_12px_28px_-18px_var(--warm-b)] transition-[opacity,filter] duration-300 [--sp-inner:color-mix(in_srgb,var(--warm-c)_6%,var(--sheet))]",
        done && "opacity-50 saturate-[0.35] hover:opacity-85",
      )}
    >
      <Text as="div" className="special-text font-bold">
        {`${done ? "Done" : "Main event"}: your questions for this day`}
      </Text>
      <Text variant="small" className="mt-0.5">
        {`${answered} of ${total} answered, ${correct} correct`}
      </Text>
      {b.total > 0 && (
        <Text variant="small" className="text-amber">
          {`+ ${b.total} bonus carried over, ${b.done} answered`}
        </Text>
      )}
      <div className="mt-2.5">
        <ProgressBar label="Questions answered" showLabel={false} segments={segments} />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button variant="special" href={`/day/${date}`}>
          Practise these questions
        </Button>
        {onUnlink && (
          <Button variant="soft" onClick={onUnlink}>
            Unlink this day
          </Button>
        )}
      </div>
    </div>
  );
}

/** v1's bonus block: unfinished work from earlier days, shared out over the next 3 planned days. */
export function BonusBlock({
  items,
  onTick,
  onUnlink,
}: {
  items: BonusItem[];
  onTick: (key: string, done: boolean) => void;
  onUnlink: (key: string) => void;
}) {
  if (!items.length) return null;
  const froms = [...new Set(items.map((i) => formatShort(i.from)))];
  return (
    <div className="mt-3.5 rounded-[14px] border-[1.5px] border-dashed border-amber bg-amber/8 px-3.5 py-3">
      <Text as="div" className="mb-1.5">
        {`**Bonus** carried over from ${froms.join(", ")}`}
      </Text>
      {items.map((it) => (
        <div key={it.key} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Pill tone="amber">{`from ${formatShort(it.from)}`}</Pill>
            <Checkbox variant="task" checked={it.done} burst={14} onChange={(v) => onTick(it.key, v)} label={it.body} />
          </div>
          <IconButton
            label="Unlink from this day"
            size="sm"
            variant="ghost"
            className="mt-6"
            onClick={() => onUnlink(it.key)}
          >
            <IconUnlink />
          </IconButton>
        </div>
      ))}
    </div>
  );
}
