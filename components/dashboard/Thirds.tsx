"use client";
// v1's three small dashboard cards under the calendar: "Last 7 days", "Mock scores", "Weakest topics".

import { BarChart, Card, Link, ProgressBar, Table, Text } from "@/components/ui";
import { PANEL } from "@/components/dashboard/kit";
import { useQuery } from "@/lib/db/client";
import { formatDate, formatShort, todayIST, type IsoDate } from "@/lib/dates";
import { dayTally, lastDays } from "@/lib/dashboard";

export function WeekCard({ today }: { today: IsoDate }) {
  const { data } = useQuery("dashboard.week", { today });
  const counts = Object.fromEntries(Object.entries(data ?? {}).map(([d, c]) => [d, c.tasks + c.questions]));
  const days = lastDays(today, counts);
  return (
    <Card className={PANEL} title="Last 7 days">
      <BarChart
        label="Ticked tasks plus answered questions, per day"
        bars={days.map((d) => ({
          key: d.date,
          label: d.letter,
          value: d.value,
          highlight: d.today,
          title: `${formatDate(d.date)}: ${d.value} done`,
          tip: `**${formatDate(d.date)}**${d.today ? " (today)" : ""}\n${dayTally(data?.[d.date]?.tasks ?? 0, data?.[d.date]?.questions ?? 0)}`,
        }))}
      />
      <Text variant="hint" className="mt-2.5">
        Ticked tasks plus answered questions, per day.
      </Text>
    </Card>
  );
}

type MockRow = { id: string; name: string; ended_at: number; score: number; max_score: number };

export function MockScoresCard() {
  const { data } = useQuery("dashboard.mocks");
  return (
    <Card className={PANEL} title="Mock scores">
      {!data?.length ? (
        <Text variant="muted">
          No mocks yet. <Link href="/practice?tab=mocks">Take a diagnostic mock</Link> to see where you start.
        </Text>
      ) : (
        <Table<MockRow>
          caption="Your latest mock scores"
          rows={data}
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "Mock", cell: (r) => <Link href={`/results/${r.id}`}>{r.name}</Link> },
            {
              key: "when",
              header: "Date",
              cell: (r) => (
                <Text as="span" variant="muted">
                  {formatShort(todayIST(r.ended_at))}
                </Text>
              ),
            },
            {
              key: "score",
              header: "Score",
              align: "right",
              cell: (r) => `**${Number(r.score.toFixed(1))}** / ${r.max_score}`,
            },
          ]}
        />
      )}
    </Card>
  );
}

export function WeakestCard() {
  const { data } = useQuery("dashboard.weakest");
  return (
    <Card className={PANEL} title="Weakest topics">
      {!data?.length ? (
        <Text variant="muted">Answer at least 3 questions in a topic and it shows up here.</Text>
      ) : (
        <div className="grid gap-2.5">
          {data.map((w) => {
            const acc = w.correct / w.n;
            return (
              <div key={w.id} className="grid gap-1">
                <div className="flex items-baseline gap-2">
                  <Link
                    href={`/practice/session?topic=${encodeURIComponent(w.id)}`}
                    className="min-w-0 flex-1 truncate"
                  >
                    {w.name}
                  </Link>
                  <Text as="span" variant="hint">
                    {`${Math.round(acc * 100)}% of ${w.n}`}
                  </Text>
                </div>
                <ProgressBar
                  label={`${w.name}: ${Math.round(acc * 100)}% right`}
                  showLabel={false}
                  value={w.correct}
                  max={w.n}
                  tone={acc < 0.5 ? "red" : "amber"}
                />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
