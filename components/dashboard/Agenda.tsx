"use client";
// v1's agenda: the selected day's tasks, its linked questions (the "main event"), work carried over from
// earlier days (bonus), the practice target and the next few days. Ticking a task saves it (plan.tickTask); bonus work isn't wired yet (useSoon). The
// copy button hands an AI chat a prompt for the day (lib/dashboard.ts dayHelpPrompt).

import { ActionRow, Button, Card, Checkbox, CopyButton, Heading, Pill, ProgressBar, Text } from "@/components/ui";
import { KIND_LABEL, KIND_PILL, PANEL, useSoon } from "@/components/dashboard/kit";
import { BonusBlock, DayLock, MainEvent, type BonusItem } from "@/components/plan/DayParts";
import { cx } from "@/components/utils/cx";
import { useMutation, useQuery } from "@/lib/db/client";
import { WEEKDAYS_SHORT, addDays, formatDate, formatLong, parseIso, weekday, type IsoDate } from "@/lib/dates";
import { dayHeading, dayHelpPrompt } from "@/lib/dashboard";

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
