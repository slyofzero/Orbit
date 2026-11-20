"use client";
// v1's planner day card ("Next 3 days"): date tile, "Today" / "Tomorrow" / weekday with the day lock, the
// kind and a copy-as-AI-prompt button, then the day's title and body. `center` = the carousel's middle card
// (its gradient ring is drawn around it by the planner); today's date tile is always yellow.

import { Card, CopyButton, DateTile, Heading, Pill, Text } from "@/components/ui";
import { KIND_LABEL, KIND_PILL } from "@/components/dashboard/kit";
import { DayLock } from "@/components/plan/DayParts";
import { DayBody } from "@/components/planner/DayBody";
import { cx } from "@/components/utils/cx";
import { useQuery } from "@/lib/db/client";
import { WEEKDAYS_SHORT, formatLong, parseIso, weekday, type IsoDate } from "@/lib/dates";
import { dayHelpPrompt } from "@/lib/dashboard";
import { cardLabel, emptyDayNote } from "@/lib/planner";

export function DayCard({
  date,
  today,
  hour,
  center,
  plan,
}: {
  date: IsoDate;
  today: IsoDate;
  hour: number;
  center: boolean;
  plan: { starts_on: IsoDate; ends_on: IsoDate };
}) {
  const { data } = useQuery("dashboard.day", { date, today });
  const day = data?.day;
  return (
    // v1's panel look without its hover lift: the planner lifts the card together with its ring
    <Card className={cx("rounded-[22px] shadow-card", center && "border-transparent")}>
      <div className="mb-3 flex items-center gap-3.5">
        <DateTile big={String(parseIso(date).d)} small={WEEKDAYS_SHORT[weekday(date)]} highlight={date === today} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Heading level={2} className="text-[1.35rem]">
              {cardLabel(date, today)}
            </Heading>
            <DayLock date={date} today={today} hour={hour} />
          </div>
          <Text variant="hint">{formatLong(date)}</Text>
        </div>
        {day && data && (
          <span className="ml-auto flex flex-none items-center gap-2">
            <Pill tone={KIND_PILL[day.kind]}>{KIND_LABEL[day.kind]}</Pill>
            <CopyButton
              hint="Copy this day as a prompt for an AI chat"
              text={() =>
                dayHelpPrompt({
                  date,
                  kindLabel: KIND_LABEL[day.kind],
                  hours: day.hours,
                  title: day.title,
                  note: day.note,
                  tasks: data.tasks.map((t) => t.body),
                  topics: data.topics.map((t) => t.name),
                  questions: data.questions.total,
                })
              }
            />
          </span>
        )}
      </div>
      {data &&
        (day ? (
          <>
            {(day.title || day.hours) && (
              <div className="mb-1 flex flex-wrap items-baseline gap-x-1.5">
                {day.title && (
                  <Text as="span" className="text-[1.05rem] font-bold">
                    {day.title}
                  </Text>
                )}
                {day.hours ? (
                  <Text as="span" variant="hint" className="whitespace-nowrap">
                    {`· ${day.hours} h`}
                  </Text>
                ) : null}
              </div>
            )}
            {day.note && (
              <Text variant="hint" className="mb-1">
                {day.note}
              </Text>
            )}
            <DayBody data={data} date={date} today={today} hour={hour} />
          </>
        ) : (
          <Text variant="muted">{`Nothing is planned for this day. ${emptyDayNote(date, plan)}`.trim()}</Text>
        ))}
    </Card>
  );
}
