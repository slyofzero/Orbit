"use client";
// v1's agenda: the selected day's tasks, its linked questions (the "main event"), work carried over from
// earlier days (bonus), the practice target and the next few days. Ticking a task saves it (plan.tickTask); bonus work isn't wired yet (useSoon). The
// copy button hands an AI chat a prompt for the day (lib/dashboard.ts dayHelpPrompt).

import {
  ActionRow,
  Button,
  Card,
  Checkbox,
  CopyButton,
  Heading,
  IconButton,
  Pill,
  ProgressBar,
  Text,
  Tooltip,
  type ProgressSegment,
} from "@/components/ui";
import { IconLock, IconLockOpen, IconUnlink } from "@/components/icons";
import { KIND_LABEL, KIND_PILL, PANEL, useSoon } from "@/components/dashboard/kit";
import { cx } from "@/components/utils/cx";
import { useMutation, useQuery } from "@/lib/db/client";
import {
  WEEKDAYS_SHORT,
  addDays,
  formatDate,
  formatLong,
  formatShort,
  parseIso,
  weekday,
  type IsoDate,
} from "@/lib/dates";
import { LOCK_HOUR, dayHeading, dayHelpPrompt, dayLock } from "@/lib/dashboard";

/** One item carried over from an earlier day (docs/PLANS.md §5). */
export type BonusItem = { key: string; from: IsoDate; body: string; done: boolean };

export function Agenda({
  today,
  hour,
  selected,
  auto,
  pick,
}: {
  today: IsoDate;
  hour: number;
  selected: IsoDate;
  /** the agenda moved to tomorrow by itself because today is done */
  auto: boolean;
  pick: (date: IsoDate) => void;
}) {
  const soon = useSoon();
  const { data } = useQuery("dashboard.day", { date: selected, today });
  const { run: tickTask } = useMutation("plan.tickTask");
  if (!data) return <Card className={cx(PANEL, "px-6 py-[22px] min-[981px]:absolute min-[981px]:inset-0")} />;
  const { day, tasks, questions, answeredOn, topics, next, upcoming } = data;
  const tomorrow = addDays(today, 1);
  // Carry-over isn't built yet (docs/PLANS.md §5): no bonus items until it is.
  const bonus: BonusItem[] = [];

  return (
    <Card className={cx(PANEL, "px-6 py-[22px] min-[981px]:absolute min-[981px]:inset-0 min-[981px]:overflow-y-auto")}>
      <div aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Heading level={2} className="text-[1.6rem]">
              {dayHeading(selected, today)}
            </Heading>
            <DayLock date={selected} today={today} hour={hour} />
          </div>
          <div className="flex items-center gap-2">
            {day && (
              <CopyButton
                hint="Copy this day as a prompt for an AI chat"
                text={() =>
                  dayHelpPrompt({
                    date: selected,
                    kindLabel: KIND_LABEL[day.kind],
                    hours: day.hours,
                    title: day.title,
                    note: day.note,
                    tasks: tasks.map((t) => t.body),
                    topics: topics.map((t) => t.name),
                    questions: questions.total,
                  })
                }
              />
            )}
            <Button variant="soft" href="/planner">
              Go to planner
            </Button>
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {(selected === today || selected === tomorrow) && (
            <Text as="span" variant="muted">
              {formatLong(selected)}
            </Text>
          )}
          {auto && <Pill tone="green">Today is done</Pill>}
          {day && <Pill tone={KIND_PILL[day.kind]}>{KIND_LABEL[day.kind]}</Pill>}
          {day?.hours ? (
            <Text as="span" variant="hint">
              {`${day.hours} h planned`}
            </Text>
          ) : null}
          {selected !== today && (
            <Button variant="soft" size="sm" onClick={() => pick(today)}>
              {auto ? "Show today" : "Back to today"}
            </Button>
          )}
        </div>

        {day ? (
          <>
            {day.title && <Text className="mt-3.5 mb-1.5 text-[1.1rem] font-bold">{day.title}</Text>}
            {day.note && (
              <Text variant="hint" className="mb-1.5">
                {day.note}
              </Text>
            )}
            {tasks.map((t) => (
              <Checkbox
                key={t.id}
                variant="task"
                checked={t.done}
                burst={tasks.every((x) => x.id === t.id || x.done) ? 70 : 14}
                onChange={(done) => tickTask({ taskId: t.id, done })}
                label={t.body}
              />
            ))}
            {questions.total > 0 && (
              <MainEvent
                date={selected}
                total={questions.total}
                answered={questions.answered}
                correct={questions.correct}
                bonus={[]}
              />
            )}
            <BonusBlock items={bonus} onTick={soon("Ticking bonus work")} onUnlink={soon("Unlinking bonus work")} />
            {questions.total > 0 && (
              <div className="mt-3.5">
                <ProgressBar
                  label={`Practice target: ${Math.min(answeredOn, questions.total)} of ${questions.total} questions`}
                  value={Math.min(answeredOn, questions.total)}
                  max={questions.total}
                  showValue={false}
                />
              </div>
            )}
            {(topics.length > 0 || day.kind === "mock") && (
              <div className="mt-3.5 flex flex-wrap gap-2">
                {topics.map((t) => (
                  <Button key={t.id} variant="soft" href={`/practice/${t.id}`}>
                    {`Practise ${t.name.split("(")[0].trim()}`}
                  </Button>
                ))}
                {day.kind === "mock" && (
                  <Button variant="primary" href="/practice/mocks">
                    Start the mock
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="mt-3.5 grid justify-items-start gap-2">
            <Text>Nothing is planned for this day.</Text>
            {next && (
              <>
                <Text variant="muted">{`The next planned day is ${formatDate(next.on_date)}${next.title ? `: ${next.title}` : ""}.`}</Text>
                <Button variant="primary" onClick={() => pick(next.on_date)}>
                  {`Open ${formatDate(next.on_date)}`}
                </Button>
              </>
            )}
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="mt-6">
            <Heading level={3} className="mb-1.5">
              Coming up
            </Heading>
            {upcoming.map((u) => (
              <ActionRow
                key={u.on_date}
                lead={{ big: String(parseIso(u.on_date).d), small: WEEKDAYS_SHORT[weekday(u.on_date)] }}
                title={u.title ?? KIND_LABEL[u.kind]}
                end={<Pill tone={KIND_PILL[u.kind]}>{KIND_LABEL[u.kind]}</Pill>}
                onClick={() => pick(u.on_date)}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/** v1's lock beside the day's name: green and open before LOCK_HOUR today, red and locked after (and on past days). */
function DayLock({ date, today, hour }: { date: IsoDate; today: IsoDate; hour: number }) {
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

/** v1's "main event": the day's linked questions in a warm gradient frame; faded once all are answered. */
function MainEvent({
  date,
  total,
  answered,
  correct,
  bonus,
}: {
  date: IsoDate;
  total: number;
  answered: number;
  correct: number;
  bonus: { total: number; done: number }[];
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
      <div className="mt-2.5 flex">
        <Button variant="special" href={`/day/${date}`}>
          Practise these questions
        </Button>
      </div>
    </div>
  );
}

/** v1's bonus block: unfinished work from earlier days, shared out over the next 3 planned days. */
function BonusBlock({
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
