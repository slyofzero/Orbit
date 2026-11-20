"use client";
// /dashboard: v1's home screen. With no plan yet it shows only the welcome that launches one; right after
// a launch, LaunchWarp plays over the dashboard and its sections rise in as the overlay dissolves.
import { useEffect, useState, type ReactNode } from "react";
import { LAUNCH_MS, LaunchWarp } from "@/components/background/LaunchWarp";
import { Agenda } from "@/components/dashboard/Agenda";
import { CalendarCard, useDayFocus } from "@/components/dashboard/DayPanels";
import { Hero } from "@/components/dashboard/Hero";
import { MilestonesCard } from "@/components/dashboard/MilestonesCard";
import { SettingsBackup } from "@/components/dashboard/SettingsBackup";
import { StandingCard } from "@/components/dashboard/StandingCard";
import { MockScoresCard, WeakestCard, WeekCard } from "@/components/dashboard/Thirds";
import { cx } from "@/components/utils/cx";
import { PlanOnboarding } from "@/components/dashboard/PlanOnboarding";
import { SetupCard } from "@/components/dashboard/SetupCard";
import { TopRow } from "@/components/dashboard/TopRow";
import { useQuery } from "@/lib/db/client";
import { istHour, todayIST, type IsoDate } from "@/lib/dates";

/** After a launch: each section rises in, one after another, as the launch overlay fades (from ~1s). */
function Rise({ on, i, className, children }: { on: boolean; i: number; className?: string; children: ReactNode }) {
  if (!on) return className ? <div className={className}>{children}</div> : <>{children}</>;
  return (
    <div
      className={cx("animate-card-in", className)}
      style={{ animationDelay: `${LAUNCH_MS * 0.63 + i * 120}ms`, animationFillMode: "both" }}
    >
      {children}
    </div>
  );
}

// v1's dashboard grid: 12 columns. The main block (calendar 5 + agenda 4, then three cards of 3) takes 9,
// the side (milestones, where you stand) 3. Below 1500px both take the full width (the side as 2 columns);
// below 980px everything is one column.
const GRID = "mt-[22px] grid grid-cols-12 items-start gap-[22px]";
const MAIN = "col-span-9 grid grid-cols-9 items-start gap-[22px] max-[1500px]:col-span-12 max-[980px]:grid-cols-1";
const SIDE = "col-span-3 grid gap-[22px] max-[1500px]:col-span-12 max-[1500px]:grid-cols-2 max-[980px]:grid-cols-1";
const CAL = "col-span-5 max-[980px]:col-span-1";
// the agenda is as tall as the calendar beside it and scrolls inside (v1)
const AGENDA = "col-span-4 max-[980px]:col-span-1 min-[981px]:relative min-[981px]:self-stretch";
const THIRD = "col-span-3 max-[980px]:col-span-1";

/** Everything under the hero. Reads the clock only in the browser, so the server and the first render agree. */
function DashboardBody({ landed }: { landed: boolean }) {
  const [now, setNow] = useState<{ today: IsoDate; hour: number } | null>(null);
  useEffect(() => setNow({ today: todayIST(), hour: istHour() }), []);
  return now ? <Body landed={landed} today={now.today} hour={now.hour} /> : null;
}

function Body({ landed, today, hour }: { landed: boolean; today: IsoDate; hour: number }) {
  const focus = useDayFocus(today);
  if (!focus.cal) return null;
  return (
    <>
      <div className={GRID}>
        <div className={MAIN}>
          <Rise on={landed} i={3} className={CAL}>
            <CalendarCard today={today} selected={focus.selected} onSelect={focus.pick} />
          </Rise>
          <Rise on={landed} i={4} className={AGENDA}>
            <Agenda today={today} hour={hour} selected={focus.selected} auto={focus.auto} pick={focus.pick} />
          </Rise>
          <Rise on={landed} i={5} className={THIRD}>
            <WeekCard today={today} />
          </Rise>
          <Rise on={landed} i={6} className={THIRD}>
            <MockScoresCard />
          </Rise>
          <Rise on={landed} i={7} className={THIRD}>
            <WeakestCard />
          </Rise>
        </div>
        <div className={SIDE}>
          <Rise on={landed} i={8}>
            <MilestonesCard today={today} />
          </Rise>
          <Rise on={landed} i={9}>
            <StandingCard today={today} />
          </Rise>
        </div>
      </div>
      <Rise on={landed} i={10}>
        <SettingsBackup />
      </Rise>
    </>
  );
}

export default function DashboardPage() {
  const { data } = useQuery("setup.status");
  const [launching, setLaunching] = useState<string | null>(null); // the plan being launched
  const [landed, setLanded] = useState(false); // after a launch: sections rise in (once, as they mount)
  if (!data) return null;

  const warp = launching && (
    <LaunchWarp
      title={launching}
      onDone={() => setLaunching(null)} // keep `landed`: unwrapping the sections would rebuild them
    />
  );
  // The overlay stays in the same place in the tree, so it keeps playing when the page switches
  // from the welcome to the dashboard halfway through the launch.
  const page = !data.hasPlan ? (
    <PlanOnboarding
      onLaunched={(name) => {
        setLaunching(name);
        setLanded(true);
      }}
    />
  ) : (
    // v1's page padding (the app frame has none, so the welcome above can run edge to edge)
    <div className="px-[clamp(18px,3.5vw,44px)] pt-[34px] pb-20 max-[760px]:pb-[100px]">
      <Rise on={landed} i={0}>
        <TopRow />
      </Rise>
      <Rise on={landed} i={1}>
        <SetupCard />
      </Rise>
      <Rise on={landed} i={2}>
        <Hero />
      </Rise>
      <DashboardBody landed={landed} />
    </div>
  );
  return (
    <>
      {page}
      {warp}
    </>
  );
}
