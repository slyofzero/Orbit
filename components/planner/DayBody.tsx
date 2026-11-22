"use client";
// What a planner day holds (v1's DayBody): its tasks, the main event (linked questions, with "Unlink this day"
// while the day isn't locked), work carried over from earlier days (bonus, docs/PLANS.md §5), the practice target,
// topic shortcuts and "Tick all" (the day's own tasks). Used by the day cards and the open day rows.

import { Button, Checkbox, ProgressBar, useToast } from "@/components/ui";
import { BonusBlock, MainEvent } from "@/components/plan/DayParts";
import { useMutation, useQuery } from "@/lib/db/client";
import type { ResultOf } from "@/lib/db/queries";
import { dayLock } from "@/lib/dashboard";
import type { IsoDate } from "@/lib/dates";

export type DayData = NonNullable<ResultOf<"dashboard.day">>;

export function DayBody({ data, date, today, hour }: { data: DayData; date: IsoDate; today: IsoDate; hour: number }) {
  const toast = useToast();
  const { run: tickTask } = useMutation("plan.tickTask");
  const { run: tickDay } = useMutation("plan.tickDay");
  const { run: unlinkDay } = useMutation("plan.unlinkDay");
  const { run: relinkDay } = useMutation("plan.relinkDay");
  const { day, tasks, questions, answeredOn, topics, carried } = data;
  if (!day) return null;
  const bonus = { total: carried.questions.length, done: carried.questions.filter((q) => q.done).length };
  const allDone = tasks.length > 0 && tasks.every((t) => t.done);
  const locked = dayLock(date, today, hour) === "locked";

  const unlink = async () => {
    const r = await unlinkDay({ dayId: day.id, today, hour });
    if (!r) return; // the hook already showed the error
    if (!r.ok) return toast(r.error, "error");
    toast(`Unlinked **${r.links.length}** question${r.links.length === 1 ? "" : "s"} from this day.`, "neutral", {
      label: "Undo",
      onClick: async () => {
        const u = await relinkDay({ dayId: r.dayId, links: r.links, ticks: r.ticks, today, hour });
        if (u && !u.ok) toast(`Couldn't undo: ${u.error}`, "error");
      },
    });
  };

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
      {questions.total + bonus.total > 0 && (
        <MainEvent
          date={date}
          total={questions.total}
          answered={questions.answered}
          correct={questions.correct}
          bonus={bonus}
          onUnlink={locked ? undefined : () => void unlink()}
        />
      )}
      <BonusBlock items={carried.tasks} onTick={(taskId, done) => tickTask({ taskId, done })} />
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
