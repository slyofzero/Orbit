"use client";
// v1's dashboard hero: countdown to the next milestone, the plan note, today's tasks, the streak and
// the day track. The rules are in lib/runway.ts; this file only lays them out.

import { useEffect, useState } from "react";
import { CountUp, Flame, ProgressRing, Rich, Runway, RunwayStat } from "@/components/ui";
import { useQuery } from "@/lib/db/client";
import { todayIST, type IsoDate } from "@/lib/dates";

export function Hero() {
  // Read the clock only in the browser, so the server and the first render agree.
  const [today, setToday] = useState<IsoDate | null>(null);
  useEffect(() => setToday(todayIST()), []);
  return today ? <HeroFor today={today} /> : null;
}

function HeroFor({ today }: { today: IsoDate }) {
  const { data: hero } = useQuery("dashboard.hero", { today });
  if (!hero) return null;

  const h = hero.headline;
  const title =
    h.kind === "none" ? (
      "Add a milestone to start the countdown"
    ) : h.kind === "past" ? (
      "Every milestone is behind you"
    ) : (
      <>
        <Rich text={h.name} /> is{" "}
        {h.kind === "in" ? (
          <>
            in <CountUp n={h.days} /> days
          </>
        ) : (
          h.kind
        )}
      </>
    );

  const t = hero.todayTasks;
  return (
    <Runway
      label="Countdown to your milestones"
      title={title}
      sub={hero.sub}
      stats={
        <>
          <RunwayStat
            title="Tasks ticked today"
            visual={
              <ProgressRing
                value={t?.done ?? 0}
                max={t?.total ?? 0}
                tone="hi"
                label="Tasks ticked today"
                className="size-[38px] max-[760px]:size-[52px] max-[560px]:size-[38px]"
              />
            }
            value={t ? `${t.done}/${t.total}` : "Rest"}
            label={t ? "tasks today" : "no plan today"}
          />
          <RunwayStat
            title="Days in a row with everything done. Rest days don't break it."
            visual={<Flame on={hero.streak > 0} />}
            value={hero.streak}
            label="day streak"
          />
        </>
      }
      ticks={hero.ticks.map((x) => ({ key: x.date, state: x.state, title: x.date }))}
      flags={hero.flags.map((f) => ({ ...f, key: f.id }))}
    />
  );
}
