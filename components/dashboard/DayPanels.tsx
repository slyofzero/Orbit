"use client";
// v1's calendar card and the agenda beside it. They share one selected date: the agenda opens on today
// (or tomorrow, once today is done) until a day is picked on the calendar or in "Coming up".

import { useMemo, useState } from "react";
import { Calendar, Card, type CalendarDay } from "@/components/ui";
import { KIND_LEGEND, KIND_TINT, PANEL } from "@/components/dashboard/kit";
import { useQuery } from "@/lib/db/client";
import { addDays, type IsoDate } from "@/lib/dates";
import { focusDay } from "@/lib/dashboard";

/** The selected date: the one picked, else today / tomorrow (`auto` = it moved to tomorrow by itself). */
export function useDayFocus(today: IsoDate) {
  const { data: cal } = useQuery("dashboard.calendar");
  const [picked, setPicked] = useState<IsoDate | null>(null);
  const status = cal?.days.find((d) => d.on_date === today)?.status;
  const tomorrowPlanned = !!cal?.days.some((d) => d.on_date === addDays(today, 1));
  const focus = focusDay(today, status, tomorrowPlanned);
  return { cal, selected: picked ?? focus, auto: picked === null && focus !== today, pick: setPicked };
}

export function CalendarCard({
  today,
  selected,
  onSelect,
}: {
  today: IsoDate;
  selected: IsoDate;
  onSelect: (date: IsoDate) => void;
}) {
  const { data: cal } = useQuery("dashboard.calendar");
  const days = useMemo(() => {
    const out: Record<IsoDate, CalendarDay> = {};
    for (const d of cal?.days ?? [])
      out[d.on_date] = {
        tone: KIND_TINT[d.kind],
        done: d.status === "done",
        label: d.title ?? undefined,
      };
    for (const m of cal?.milestones ?? []) out[m.on_date] = { ...out[m.on_date], tag: m.short ?? m.name };
    return out;
  }, [cal]);
  return (
    <Card className={PANEL}>
      <Calendar today={today} selected={selected} onSelect={onSelect} days={days} legend={KIND_LEGEND} />
    </Card>
  );
}
