"use client";
// Stats → Subjects & topics: every subject, then every topic (of one subject, or all), as sortable tables of
// questions tried, times answered right / wrong / skipped, accuracy, strength and time. A topic row opens its
// practice screen in a new tab.

import { Dropdown, Table, Text, type Column } from "@/components/ui";
import { formatShort, todayIST } from "@/lib/dates";
import {
  accuracy,
  avgTime,
  formatDuration,
  formatPct,
  strengthText,
  topicHref,
  type StatsGroup,
  type StatsSummary,
  type StatsTopic,
} from "@/lib/stats";

/** The columns a subject and a topic share. */
function countColumns<T extends StatsGroup>(): Column<T>[] {
  const acc = (r: T) => accuracy(r.correct, r.incorrect);
  return [
    {
      key: "tried",
      header: "Tried",
      align: "right",
      cell: (r) => `${r.tried} / ${r.total}`,
      sortValue: (r) => (r.total ? r.tried / r.total : 0),
    },
    { key: "right", header: "Right", align: "right", cell: (r) => r.correct, sortValue: (r) => r.correct },
    { key: "wrong", header: "Wrong", align: "right", cell: (r) => r.incorrect, sortValue: (r) => r.incorrect },
    { key: "skipped", header: "Skipped", align: "right", cell: (r) => r.skipped, sortValue: (r) => r.skipped },
    {
      key: "acc",
      header: "Accuracy",
      align: "right",
      cell: (r) => formatPct(acc(r)),
      sortValue: (r) => acc(r) ?? -1,
    },
    {
      key: "strength",
      header: "Strength",
      align: "right",
      special: true,
      cell: (r) => strengthText(r.strength),
      sortValue: (r) => r.strength ?? -1,
    },
    {
      key: "time",
      header: "Time spent",
      align: "right",
      cell: (r) => formatDuration(r.time_ms),
      sortValue: (r) => r.time_ms,
    },
    {
      key: "avg",
      header: "Avg per answer",
      align: "right",
      cell: (r) => formatDuration(avgTime(r)),
      sortValue: (r) => avgTime(r) ?? -1,
    },
    {
      key: "last",
      header: "Last seen",
      align: "right",
      cell: (r) => (r.last_at === null ? "never" : formatShort(todayIST(r.last_at))),
      sortValue: (r) => r.last_at ?? 0,
    },
  ];
}

export function StatsTopics({
  data,
  subject,
  onSubject,
}: {
  data: StatsSummary;
  subject: string; // "" = every subject
  onSubject: (id: string) => void;
}) {
  const topics = subject ? data.topics.filter((t) => t.subject_id === subject) : data.topics;
  const subjectCols: Column<StatsGroup>[] = [
    { key: "name", header: "Subject", cell: (r) => r.name, sortValue: (r) => r.name.toLowerCase() },
    ...countColumns<StatsGroup>(),
  ];
  const topicCols: Column<StatsTopic>[] = [
    { key: "name", header: "Topic", cell: (r) => r.name, sortValue: (r) => r.name.toLowerCase() },
    ...(subject
      ? []
      : [
          {
            key: "subject",
            header: "Subject",
            cell: (r: StatsTopic) => r.subject_name,
            sortValue: (r: StatsTopic) => r.subject_name.toLowerCase(),
          },
        ]),
    ...countColumns<StatsTopic>(),
  ];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-[260px]">
          <Dropdown
            searchable
            value={subject}
            onChange={onSubject}
            options={[
              { value: "", label: "All subjects" },
              ...data.subjects.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
        <Text variant="small" className="min-w-[240px] flex-1">
          {
            "**Strength** is accuracy with recent and harder answers counting more (see the Overview). **Time spent** counts only while a question is on screen and you are active, skips included. Click a column to sort."
          }
        </Text>
      </div>

      {!subject && (
        <Table
          caption="Subjects"
          columns={subjectCols}
          rows={data.subjects}
          rowKey={(r) => r.id}
          empty="No subjects yet."
        />
      )}

      <div className="grid gap-2">
        <Text variant="small">
          {`${topics.length} topic${topics.length === 1 ? "" : "s"}. Click a row to practise that topic (opens in a new tab).`}
        </Text>
        <Table
          caption="Topics"
          columns={topicCols}
          rows={topics}
          rowKey={(r) => r.id}
          rowHref={(r) => topicHref(r) ?? null}
          empty="No topics in this subject."
        />
      </div>
    </div>
  );
}
