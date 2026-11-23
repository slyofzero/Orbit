"use client";
// Manage plan (/planner/manage): the plan's counterpart of Manage pack. The title row holds the plan's actions
// (Unlink questions, Export plan, Upload plan: components/planner/PlanActions.tsx; Edit plan opens
// /planner/edit) and Back to planner. Below, every task of the plan in a table: From today · Past · All, a DateFilter (a day, week,
// month or weekday, typed or picked; it overrides the tabs) and the day's kind. A page is DAY_PAGE (5) plan days, each day's
// tasks together with a heavier line between days; a done task's row is green, one missed on a past day red. From
// today opens on today, Past on the latest day, All on the page holding today; changing a filter goes back there.

import { useEffect, useState } from "react";
import { KIND_LABEL, KIND_PILL } from "@/components/dashboard/kit";
import { IconChevronLeft, IconChevronRight, IconPencil, IconUnlink, IconUpload } from "@/components/icons";
import { UnlinkQuestions, UploadPlan, pageNav, useExportPlan, type Clock } from "@/components/planner/PlanActions";
import {
  Button,
  DateFilter,
  Dropdown,
  EmptyState,
  Heading,
  Pill,
  Rich,
  Table,
  Tabs,
  Text,
  type Column,
} from "@/components/ui";
import { useQuery } from "@/lib/db/client";
import type { ResultOf } from "@/lib/db/queries";
import { formatRange, formatShort, formatDate, istHour, todayIST, type DateRange } from "@/lib/dates";
import { previewText } from "@/lib/manage";
import { DAY_PAGE, TASK_WHEN, TASK_WHEN_LABEL, type TaskWhen } from "@/lib/planner";
import type { PlanDayKind } from "@/types/tables";

type Row = NonNullable<ResultOf<"planner.tasks">>["rows"][number];
const KINDS = Object.keys(KIND_LABEL) as PlanDayKind[];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Reads the clock only in the browser, so the server and the first render agree. */
export function ManagePlan() {
  const [clock, setClock] = useState<Clock | null>(null);
  useEffect(() => setClock({ today: todayIST(), hour: istHour() }), []);
  return clock ? <Tasks clock={clock} /> : null;
}

function Tasks({ clock }: { clock: Clock }) {
  const { today } = clock;
  const exportPlan = useExportPlan();
  const [dialog, setDialog] = useState<"unlink" | "upload" | null>(null);
  const shut = () => setDialog(null);
  // back from Edit plan: the page slides in from the left (styles/animations/page-slide.css)
  const [back] = useState(() => pageNav.leftEdit);
  useEffect(() => {
    pageNav.leftEdit = false;
  }, []);
  const [when, setWhen] = useState<TaskWhen>("upcoming");
  const [kind, setKind] = useState<PlanDayKind | "">("");
  const [range, setRange] = useState<DateRange | null>(null); // a day, week, month or weekday; overrides the tabs
  const [page, setPage] = useState<number | null>(null); // 0-based; null = where this list opens (see the top)
  // which side the table slides in from: the side of the tab or page you moved to (styles/animations/manage-plan.css)
  const [slide, setSlide] = useState<"right" | "left" | null>(null);
  const { data } = useQuery("planner.tasks", {
    search: "",
    when,
    kind: kind || null,
    range: range && { from: range.from, to: range.to, weekday: range.weekday ?? null },
    today,
    page,
    days: DAY_PAGE,
  });
  if (data === undefined) return null;

  const reset = () => setPage(null);
  /** A done task is green, one left undone on a day that has passed is red, the rest stay plain. */
  const toneOf = (r: Row) => (r.done ? "green" : r.on_date < today ? "red" : null);
  const columns: Column<Row>[] = [
    {
      key: "date",
      header: "Date",
      cell: (r) => (
        <span className={r.on_date === today ? "font-bold whitespace-nowrap text-accent" : "whitespace-nowrap"}>
          {formatDate(r.on_date)}
        </span>
      ),
    },
    {
      key: "day",
      header: "Day",
      cell: (r) => (
        <span className="block max-w-[220px] truncate text-gray">
          <Rich text={r.title ?? KIND_LABEL[r.kind]} />
        </span>
      ),
    },
    { key: "kind", header: "Type", cell: (r) => <Pill tone={KIND_PILL[r.kind]}>{KIND_LABEL[r.kind]}</Pill> },
    {
      key: "task",
      header: "Task",
      cell: (r) => (
        <>
          <Rich text={previewText(r.body, 120)} />
          {/* the row's tint says this to the eye; this says it to a screen reader */}
          {toneOf(r) && <span className="sr-only">{toneOf(r) === "green" ? " (done)" : " (missed)"}</span>}
        </>
      ),
    },
  ];

  return (
    <div className={back ? "motion-safe:animate-page-from-left" : undefined}>
      <div className="mb-[18px] flex flex-wrap items-center gap-3">
        <Heading level={1}>Manage plan</Heading>
        <div className="ml-auto flex flex-wrap gap-2">
          {data && (
            <>
              {data.linked && (
                <Button variant="soft" icon={<IconUnlink />} onClick={() => setDialog("unlink")}>
                  Unlink questions
                </Button>
              )}
              <Button variant="soft" icon={<IconPencil />} href="/planner/edit">
                Edit plan
              </Button>
              <Button variant="soft" loading={exportPlan.pending} onClick={exportPlan.run}>
                Export plan
              </Button>
            </>
          )}
          <Button variant="soft" icon={<IconUpload />} onClick={() => setDialog("upload")}>
            Upload plan
          </Button>
          <Button variant="secondary" href="/planner" icon={<IconChevronLeft />}>
            Back to planner
          </Button>
        </div>
      </div>
      <UnlinkQuestions open={dialog === "unlink"} onClose={shut} clock={clock} />
      <UploadPlan open={dialog === "upload"} onClose={shut} clock={clock} current={data?.plan.name ?? null} />

      {!data ? (
        <EmptyState icon="🗓️" title="There is no plan yet.">
          Upload a plan and its tasks show up here.
        </EmptyState>
      ) : (
        <>
          <Text variant="muted">
            {`**${data.plan.name}**: ${formatDate(data.plan.starts_on)} to ${formatDate(data.plan.ends_on)}, ${plural(data.counts.all, "task")} over ${plural(data.counts.days, "day")}, ${data.counts.done} done.`}
          </Text>

          <div className="mt-3.5 mb-2 flex flex-wrap items-center gap-2">
            <Tabs
              shape="bar"
              label="Which tasks"
              value={when}
              onChange={(w) => {
                setSlide(TASK_WHEN.indexOf(w) > TASK_WHEN.indexOf(when) ? "right" : "left");
                setWhen(w);
                reset();
              }}
              tabs={TASK_WHEN.map((w) => ({ value: w, label: TASK_WHEN_LABEL[w], count: data.counts[w] }))}
            />
            <div className="min-w-[260px] flex-1">
              <DateFilter
                value={range}
                onChange={(r) => {
                  setRange(r);
                  reset();
                }}
                min={data.plan.starts_on}
                max={data.plan.ends_on}
              />
            </div>
            <div className="w-[190px]">
              <Dropdown
                value={kind}
                onChange={(v) => {
                  setKind(v as PlanDayKind | "");
                  reset();
                }}
                options={[
                  { value: "", label: "Every type of day" },
                  ...KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] })),
                ]}
              />
            </div>
          </div>
          <div className="mb-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
            <Text variant="small">
              {range
                ? `${plural(data.matched.tasks, "task")} in **${formatRange(range)}**, whichever tab is open. Clear the date to see the rest. Tick tasks off on the Planner.`
                : `${plural(data.matched.tasks, "task")} on ${plural(data.matched.days, "day")}, ${DAY_PAGE} days at a time. Tick tasks off on the Planner.`}
            </Text>
            <div className="ml-auto flex items-center gap-3.5" aria-label="Legend">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-4 rounded-[3px] bg-green/30" />
                <Text as="span" variant="small">
                  Done
                </Text>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-4 rounded-[3px] bg-red/30" />
                <Text as="span" variant="small">
                  Missed
                </Text>
              </span>
            </div>
          </div>

          {/* keyed by the tab and page the rows belong to, so it slides in again once the new rows arrive */}
          <div
            key={`${data.when}:${data.page}:${data.range?.from ?? ""}:${data.range?.to ?? ""}:${data.range?.weekday ?? ""}`}
            className={
              slide === "right" ? "animate-tasks-from-right" : slide === "left" ? "animate-tasks-from-left" : undefined
            }
          >
            <Table
              columns={columns}
              rows={data.rows}
              rowKey={(r) => String(r.id)}
              groupBy={(r) => r.on_date}
              rowTone={toneOf}
              empty="Nothing matches."
            />
          </div>
          {data.pages > 1 && (
            <nav aria-label="Pages of tasks" className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
              <Button
                variant="soft"
                size="sm"
                icon={<IconChevronLeft />}
                disabled={data.page === 0}
                onClick={() => {
                  setSlide("left");
                  setPage(data.page - 1);
                }}
              >
                Previous
              </Button>
              <Text as="span" variant="small">
                {`Page ${data.page + 1} of ${data.pages}${data.rows.length ? ` · ${formatShort(data.rows[0].on_date)} to ${formatShort(data.rows[data.rows.length - 1].on_date)}` : ""}`}
              </Text>
              <Button
                variant="soft"
                size="sm"
                iconAfter={<IconChevronRight />}
                disabled={data.page >= data.pages - 1}
                onClick={() => {
                  setSlide("right");
                  setPage(data.page + 1);
                }}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
