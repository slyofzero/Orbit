"use client";
// What a planner day holds (v1's DayBody): its tasks, the main event (linked questions), carried-over bonus
// work, the practice target, topic shortcuts and "Tick all". Used by the day cards and the open day rows.

import { Button, Checkbox, ProgressBar } from "@/components/ui";
import { useSoon } from "@/components/dashboard/kit";
import { BonusBlock, MainEvent, type BonusItem } from "@/components/plan/DayParts";
import { useMutation, useQuery } from "@/lib/db/client";
import type { ResultOf } from "@/lib/db/queries";
import { dayLock } from "@/lib/dashboard";
import type { IsoDate } from "@/lib/dates";

export type DayData = NonNullable<ResultOf<"dashboard.day">>;

export function DayBody({ data, date, today, hour }: { data: DayData; date: IsoDate; today: IsoDate; hour: number }) {
  const soon = useSoon();
  const { run: tickTask } = useMutation("plan.tickTask");
  const { run: tickDay } = useMutation("plan.tickDay");
  const { day, tasks, questions, answeredOn, topics } = data;
  if (!day) return null;
  const allDone = tasks.length > 0 && tasks.every((t) => t.done);
  const locked = dayLock(date, today, hour) === "locked";
  // Carry-over isn't built yet (docs/PLANS.md §5, TODO.md): no bonus items until it is.
  const bonus: BonusItem[] = [];

  return (
    <>
      {tasks.map((t) => (
        <Checkbox
          key={t.id}
          variant="task"
          checked={t.done}
          burst={tasks.every((x) => x.id === t.id || x.done) ? 60 : 12}
          onChange={(done) => tickTask({ taskId: t.id, done })}
          label={t.body}
        />
      ))}
      {questions.total > 0 && (
        <MainEvent
          date={date}
          total={questions.total}
          answered={questions.answered}
          correct={questions.correct}
          bonus={[]}
          onUnlink={locked ? undefined : soon("Unlinking this day's questions")}
        />
      )}
      {date >= today && (
        <BonusBlock items={bonus} onTick={soon("Ticking bonus work")} onUnlink={soon("Unlinking bonus work")} />
      )}
      {questions.total > 0 && (
        <div className="mt-2.5 mb-1">
          <ProgressBar
            label={`Practice target: ${Math.min(answeredOn, questions.total)} of ${questions.total} questions`}
            value={Math.min(answeredOn, questions.total)}
            max={questions.total}
            showValue={false}
          />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {topics.map((t) => (
          <Button key={t.id} variant="soft" size="sm" href={`/practice/${t.id}`}>
            {t.name.split("(")[0].trim()}
          </Button>
        ))}
        {day.kind === "mock" && (
          <Button variant="primary" size="sm" href="/practice/mocks">
            Start the mock
          </Button>
        )}
        {tasks.length > 0 && (
          <Button
            variant="soft"
            size="sm"
            className="ml-auto"
            onClick={() => tickDay({ dayId: day.id, done: !allDone })}
          >
            {allDone ? "Untick all" : "Tick all"}
          </Button>
        )}
      </div>
    </>
  );
}

/** An open day row's body: loads the day, then shows it. */
export function RowBody({ date, today, hour }: { date: IsoDate; today: IsoDate; hour: number }) {
  const { data } = useQuery("dashboard.day", { date, today });
  return data ? <DayBody data={data} date={date} today={today} hour={hour} /> : null;
}
