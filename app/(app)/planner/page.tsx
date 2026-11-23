"use client";
// /planner: v1's planner. Tabs: "Next 3 days" (day cards you can step through), "Full plan" (every day,
// by month and week; v1 grouped by phase, which plans don't have yet) and "Missed" (past days left
// unfinished). The open tab is in the address (?tab=next | full_plan | missed); each tab's content pops
// in, piece by piece, when it opens. Link questions sits beside Manage plan (/planner/manage), where the rest
// of the plan's actions live.

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useTab } from "@/components/utils/useTab";
import { Page } from "@/components/app/Page";
import { cx } from "@/components/utils/cx";
import { KIND_LABEL, KIND_PILL } from "@/components/dashboard/kit";
import { IconChevronLeft, IconChevronRight, IconSparkle } from "@/components/icons";
import { DayCard } from "@/components/planner/DayCard";
import { LinkQuestions } from "@/components/planner/PlanActions";
import { RowBody } from "@/components/planner/DayBody";
import {
  Button,
  Card,
  DayRow,
  DayStrip,
  Disclosure,
  EmptyState,
  GLOW,
  Heading,
  IconButton,
  Pill,
  Tabs,
  Text,
  Tooltip,
} from "@/components/ui";
import { useQuery } from "@/lib/db/client";
import { WEEKDAYS_SHORT, formatShort, istHour, parseIso, todayIST, weekday, type IsoDate } from "@/lib/dates";
import {
  carouselDays,
  dayCount,
  dayState,
  groupByMonth,
  missedDays,
  stripLabel,
  stripSegments,
  type PlannerDay,
} from "@/lib/planner";

const VIEWS = ["next", "full_plan", "missed"] as const;
type Clock = { today: IsoDate; hour: number };

/** Pops in (rises and grows a little), `i` steps after the first piece of the tab; long lists stop
 *  staggering after a dozen so the last rows don't wait. */
function Pop({ i, className, children }: { i: number; className?: string; children: ReactNode }) {
  return (
    <div
      className={cx("animate-card-in", className)}
      style={{ animationDelay: `${Math.min(i, 12) * 60}ms`, animationFillMode: "both" }}
    >
      {children}
    </div>
  );
}

/** useSearchParams (the tab) needs a Suspense boundary. */
export default function PlannerPage() {
  return (
    <Suspense fallback={null}>
      <PlannerLoader />
    </Suspense>
  );
}

/** Reads the clock only in the browser, so the server and the first render agree. */
function PlannerLoader() {
  const [now, setNow] = useState<Clock | null>(null);
  useEffect(() => setNow({ today: todayIST(), hour: istHour() }), []);
  const { data } = useQuery("planner.days");
  if (data === undefined || !now) return null;
  return (
    <Page>
      {data ? (
        <Planner plan={data.plan} days={data.days} {...now} />
      ) : (
        <EmptyState
          title="No plan yet"
          action={
            <Button variant="primary" href="/dashboard">
              Load a plan
            </Button>
          }
        >
          Load a plan and this page fills with what to do each day, with your milestones. Nothing is built in.
        </EmptyState>
      )}
    </Page>
  );
}

function Planner({
  plan,
  days,
  today,
  hour,
}: {
  plan: { name: string; starts_on: IsoDate; ends_on: IsoDate };
  days: PlannerDay[];
} & Clock) {
  const [view, setView] = useTab(VIEWS, "next");
  const [offset, setOffset] = useState(0); // how many days the 3-day window is shifted from today
  const [linking, setLinking] = useState(false);
  const missed = missedDays(days, today);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 justify-between">
        <Heading level={1} className="mr-2">
          Planner
        </Heading>
        <div className="flex flex-wrap gap-2">
          <Tooltip
            placement="bottom"
            content="Let an AI chat pair each open day with practice questions from your bank. You copy one prompt, paste its reply back, and every day gets **questions that match its topics**, so you open a day and just practise. Past days are never changed."
          >
            <Button variant="special" icon={<IconSparkle />} onClick={() => setLinking(true)}>
              Link questions
            </Button>
          </Tooltip>
          <Button variant="soft" href="/planner/manage">
            Manage plan
          </Button>
        </div>
      </div>
      <LinkQuestions open={linking} onClose={() => setLinking(false)} clock={{ today, hour }} />
      <Text variant="hint" className="mt-1 mb-4">
        {plan.name}
      </Text>
      {/* the tabs, and on "Next 3 days" the day stepper at the far end of the same row: it stays put
          however tall the cards below are */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Planner views"
          value={view}
          onChange={setView}
          tabs={[
            { value: "next", label: "Next 3 days" },
            { value: "full_plan", label: "Full plan" },
            { value: "missed", label: "Missed", ...(missed.length ? { count: missed.length } : {}) },
          ]}
        />
        {view === "next" && (
          <div className="flex animate-card-in items-center gap-1.5">
            <IconButton label="Previous day" size="sm" onClick={() => setOffset(offset - 1)}>
              <IconChevronLeft />
            </IconButton>
            <Button variant="soft" size="sm" disabled={offset === 0} onClick={() => setOffset(0)}>
              Today
            </Button>
            <IconButton label="Next day" size="sm" onClick={() => setOffset(offset + 1)}>
              <IconChevronRight />
            </IconButton>
          </div>
        )}
      </div>

      {/* keyed by the tab, so switching tabs mounts the new content and its pieces pop in again */}
      <div key={view} className="mt-5">
        {view === "next" && <NextDays offset={offset} today={today} hour={hour} plan={plan} />}

        {view === "missed" &&
          (missed.length === 0 ? (
            <Pop i={0}>
              <Card>
                <Text variant="muted">No missed days. Nice.</Text>
              </Card>
            </Pop>
          ) : (
            <div className="grid gap-1.5">
              {missed.map((d, i) => (
                <Pop key={d.on_date} i={i}>
                  <Row d={d} today={today} hour={hour} />
                </Pop>
              ))}
            </div>
          ))}

        {view === "full_plan" && <FullPlan days={days} today={today} hour={hour} />}
      </div>
    </>
  );
}

/** "Next 3 days" as a carousel: the centre card is today (or the day you stepped to), ringed by the special
 *  gradient, with a smaller, dimmer day on either side. All cards share one grid cell and are moved by
 *  transform, keyed by date, so stepping slides every card one place along; the day stepped towards
 *  slides in from off screen (it waits there, hidden, as `pos` ±2). Phones show only the centre card. */
function NextDays({
  offset,
  today,
  hour,
  plan,
}: { offset: number; plan: { starts_on: IsoDate; ends_on: IsoDate } } & Clock) {
  return (
    // clip sideways only, so the centre card's glow and hover lift still show above and below
    <div className="-my-4 overflow-x-clip py-4">
      <div className="mx-auto grid grid-cols-1 w-[calc((100%-40px)/3)] max-[1100px]:w-full">
        {carouselDays(today, offset).map(({ date, pos }) => {
          const center = pos === 0;
          const side = Math.abs(pos) === 1;
          return (
            <div
              key={date}
              inert={!center && !side}
              aria-hidden={!center && !side}
              className={cx(
                "relative self-start transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] [grid-area:1/1]",
                center
                  ? "z-10 opacity-100"
                  : side
                    ? "opacity-60 hover:opacity-100 max-[1100px]:pointer-events-none max-[1100px]:opacity-0"
                    : "pointer-events-none opacity-0",
              )}
              style={{ transform: `translateX(calc(${pos} * (100% + 20px))) scale(${center ? 1 : 0.94})` }}
            >
              <Pop i={Math.abs(pos)}>
                <div className="relative rounded-[24px] p-[2px] transition-transform duration-200 hover:-translate-y-0.5">
                  {/* the centre card's ring: a flowing gradient that fades over to the next card when you step */}
                  <div
                    aria-hidden="true"
                    className={cx(
                      "special-fill animate-flow absolute inset-0 rounded-[24px] transition-opacity duration-500",
                      GLOW.low, // today's card: the lowest glow
                      center ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="relative">
                    <DayCard date={date} today={today} hour={hour} center={center} plan={plan} />
                  </div>
                </div>
              </Pop>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One day as a row; opening it loads the day's body. */
function Row({ d, today, hour }: { d: PlannerDay } & Clock) {
  const state = dayState(d, today);
  return (
    <DayRow
      lead={{ big: String(parseIso(d.on_date).d), small: WEEKDAYS_SHORT[weekday(d.on_date)] }}
      title={d.title ?? KIND_LABEL[d.kind]}
      end={<Pill tone={KIND_PILL[d.kind]}>{KIND_LABEL[d.kind]}</Pill>}
      count={dayCount(d)}
      today={d.on_date === today}
      past={d.on_date < today}
      tone={state === "won" ? "won" : state === "missed" ? "missed" : undefined}
    >
      <RowBody date={d.on_date} today={today} hour={hour} />
    </DayRow>
  );
}

/** "Full plan": one section per month (the current one open), weeks inside, each day a row. */
function FullPlan({ days, today, hour }: { days: PlannerDay[] } & Clock) {
  return (
    <div className="grid gap-2">
      {groupByMonth(days, today).map((m, mi) => {
        const segments = stripSegments(m.days, today);
        return (
          <Pop key={m.key} i={mi}>
            <Disclosure
              defaultOpen={m.current}
              className="rounded-[18px]"
              title={
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 py-1">
                  <Heading level={2} className="flex-1 text-[1.12rem]">
                    {m.label}
                  </Heading>
                  <Text as="span" variant="hint" className="font-normal">
                    {`${formatShort(m.from)} to ${formatShort(m.to)}`}
                  </Text>
                  <DayStrip segments={segments} label={stripLabel(segments)} />
                </span>
              }
            >
              {m.weeks.map((w, i) => (
                <div key={w.start}>
                  <Text
                    className={
                      i === 0
                        ? "mt-1 mb-2.5 font-display text-[1.15rem] font-bold"
                        : "mt-5 mb-2.5 font-display text-[1.15rem] font-bold"
                    }
                  >
                    {w.label}
                  </Text>
                  <div className="grid gap-1.5">
                    {w.days.map((d) => (
                      <Row key={d.on_date} d={d} today={today} hour={hour} />
                    ))}
                  </div>
                </div>
              ))}
            </Disclosure>
          </Pop>
        );
      })}
    </div>
  );
}
