"use client";
// /stats/question?id=<question id>: one question's history (Stats → Questions opens it). The question, its totals,
// then every sitting it was shown in (newest first): answered right, wrong, or left unanswered, the time spent, and
// whether it was practice or a mock. Data: `stats.history` (lib/db/queries/stats.ts).

import {
  Button,
  Callout,
  Card,
  EmptyState,
  Heading,
  Pill,
  Rich,
  StatTile,
  Table,
  Text,
  type Column,
} from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";
import { useQuery } from "@/lib/db/client";
import { formatShort, todayIST } from "@/lib/dates";
import { formatDuration, istClock, questionHref, type HistoryEntry } from "@/lib/stats";

const BACK = "/stats?tab=questions";

const columns: Column<HistoryEntry>[] = [
  {
    key: "when",
    header: "When",
    cell: (e) => `${formatShort(todayIST(e.recorded_at))}, ${istClock(e.recorded_at)}`,
  },
  {
    key: "result",
    header: "Result",
    cell: (e) =>
      e.outcome === "correct" ? (
        <Pill tone="green">Right</Pill>
      ) : e.outcome === "incorrect" ? (
        <Pill tone="red">Wrong</Pill>
      ) : (
        <Pill>Unanswered</Pill>
      ),
  },
  { key: "time", header: "Time spent", align: "right", cell: (e) => formatDuration(e.time_ms) },
  {
    key: "where",
    header: "Where",
    cell: (e) => (e.attempt_id ? `Mock: ${e.mock_name ?? "deleted mock"}` : "Practice"),
  },
];

export function QuestionHistory({ questionId }: { questionId: string | null }) {
  const { data, error } = useQuery("stats.history", { questionId: questionId ?? "" });
  if (!questionId)
    return (
      <EmptyState icon="🔎" title="No question chosen" action={<Button href={BACK}>Back to Stats</Button>}>
        Open a question from the Questions tab of Stats.
      </EmptyState>
    );
  if (!data)
    return error ? (
      <Callout tone="caution" title="Couldn't load this question's history">
        {error.startsWith("Unknown query")
          ? "Another Orbit tab is running an older version of the app. **Reload every Orbit tab** (or close the others), then reload this one."
          : error}
      </Callout>
    ) : null;
  const q = data.question;
  if (!q)
    return (
      <EmptyState icon="🔎" title="Question not found" action={<Button href={BACK}>Back to Stats</Button>}>
        {`There is no question with the id \`${questionId}\`.`}
      </EmptyState>
    );

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button href={BACK} variant="ghost" size="sm" icon={<IconChevronLeft />}>
          Stats
        </Button>
        <Heading level={1}>Question history</Heading>
        <Pill tone="neutral">{`${q.subject_name} · ${q.topic_name}`}</Pill>
        <Button variant="primary" className="ml-auto" href={questionHref(q)}>
          {q.pool === "mock" ? "Open in the editor" : "Practise this question"}
        </Button>
      </div>

      <Card>
        <Rich block text={q.stem} />
      </Card>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
        <StatTile value={q.shown} label="times shown" tone="accent" />
        <StatTile value={q.correct} label="right" tone="green" />
        <StatTile value={q.incorrect} label="wrong" tone="amber" />
        <StatTile value={q.skipped} label="unanswered" />
        <StatTile value={formatDuration(q.time_ms)} label="time spent" />
        <StatTile value={data.streak} label="right in a row" />
      </div>

      <div className="grid gap-2">
        <Text variant="small">
          {
            "Every time this question was shown, newest first. **Time spent** counts only while it was on screen and you were active. **Unanswered** = opened and left without answering."
          }
        </Text>
        <Table
          caption="Every time this question was shown"
          columns={columns}
          rows={data.entries}
          rowKey={(e) => e.id}
          rowTone={(e) => (e.outcome === "correct" ? "green" : e.outcome === "incorrect" ? "red" : null)}
          empty="Never shown yet."
        />
      </div>
    </div>
  );
}
