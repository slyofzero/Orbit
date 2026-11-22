"use client";
// Stats → Questions: every live question you have been shown, one page at a time: how often it was shown, times
// right / wrong / skipped, the time you spent on it (only while it was on screen and you were active), and your
// latest answer. "Mistake log" keeps the questions whose latest answer was wrong (docs/STATS.md §4). A row opens
// its history page, /stats/question?id= (QuestionHistory.tsx). Sorted by the query (the list is paged), so the columns don't sort.

import { useEffect, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { useRouter } from "next/navigation";
import { Button, Dropdown, Pill, Rich, Segmented, Table, Text, type Column } from "@/components/ui";
import { useQuery } from "@/lib/db/client";
import { formatShort, todayIST } from "@/lib/dates";
import { pageOf, previewText } from "@/lib/manage";
import {
  STATS_PAGE,
  avgTime,
  formatDuration,
  historyHref,
  type QuestionShow,
  type QuestionSort,
  type StatsQuestion,
  type StatsSummary,
} from "@/lib/stats";

const SORTS: { value: QuestionSort; label: string }[] = [
  { value: "recent", label: "Most recent first" },
  { value: "time", label: "Most time spent" },
  { value: "wrong", label: "Most times wrong" },
  { value: "accuracy", label: "Lowest accuracy" },
  { value: "shown", label: "Most often shown" },
];

const columns: Column<StatsQuestion>[] = [
  { key: "text", header: "Question", cell: (r) => <Rich text={previewText(r.stem, 90)} /> },
  { key: "topic", header: "Topic", cell: (r) => r.topic_name },
  { key: "shown", header: "Shown", align: "right", cell: (r) => r.shown },
  { key: "right", header: "Right", align: "right", cell: (r) => r.correct },
  { key: "wrong", header: "Wrong", align: "right", cell: (r) => r.incorrect },
  { key: "skipped", header: "Skipped", align: "right", cell: (r) => r.skipped },
  { key: "time", header: "Time spent", align: "right", special: true, cell: (r) => formatDuration(r.time_ms) },
  { key: "avg", header: "Avg per answer", align: "right", cell: (r) => formatDuration(avgTime(r)) },
  {
    key: "latest",
    header: "Latest",
    align: "center",
    cell: (r) =>
      r.latest === "correct" ? (
        <Pill tone="green">Right</Pill>
      ) : r.latest === "incorrect" ? (
        <Pill tone="red">Wrong</Pill>
      ) : (
        <Pill>Skipped</Pill>
      ),
  },
  {
    key: "last",
    header: "Last seen",
    align: "right",
    cell: (r) => (r.last_at === null ? "never" : formatShort(todayIST(r.last_at))),
  },
];

export function StatsQuestions({
  data,
  subject,
  onSubject,
  show,
  onShow,
}: {
  data: StatsSummary;
  subject: string; // "" = every subject
  onSubject: (id: string) => void;
  show: QuestionShow;
  onShow: (s: QuestionShow) => void;
}) {
  const [topic, setTopic] = useState("");
  const [sort, setSort] = useState<QuestionSort>("recent");
  const [page, setPage] = useState(0); // 0-based
  const router = useRouter();
  const { data: list } = useQuery("stats.questions", {
    subjectId: subject || null,
    topicId: topic || null,
    show,
    sort,
    limit: STATS_PAGE,
    offset: page * STATS_PAGE,
  });
  const pager = pageOf(list?.matched ?? 0, page, STATS_PAGE);
  // the list shrank under this page (another tab answered a mistake right): go to its new last page
  useEffect(() => {
    if (list && page > 0 && page !== pager.page) setPage(pager.page);
  }, [list, page, pager.page]);

  const topics = subject ? data.topics.filter((t) => t.subject_id === subject) : data.topics;
  const shown = topics.filter((t) => t.shown > 0);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented
          label="Which questions"
          value={show}
          onChange={(v) => {
            onShow(v);
            setPage(0);
          }}
          segments={[
            { value: "all", label: "All shown" },
            { value: "mistakes", label: `Mistake log (${data.totals.mistakes})` },
          ]}
        />
        <div className="w-[220px]">
          <Dropdown
            searchable
            value={subject}
            onChange={(v) => {
              onSubject(v);
              setTopic("");
              setPage(0);
            }}
            options={[
              { value: "", label: "All subjects" },
              ...data.subjects.filter((s) => s.shown > 0).map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
        <div className="w-[250px]">
          <Dropdown
            searchable
            value={topic}
            onChange={(v) => {
              setTopic(v);
              setPage(0);
            }}
            options={[
              { value: "", label: "All topics" },
              ...shown.map((t) => ({ value: t.id, label: t.name, group: t.subject_name })),
            ]}
          />
        </div>
        <div className="w-[210px]">
          <Dropdown
            value={sort}
            onChange={(v) => {
              setSort(v);
              setPage(0);
            }}
            options={SORTS}
          />
        </div>
      </div>
      <Text variant="small">
        {list
          ? show === "mistakes"
            ? `${list.matched} question${list.matched === 1 ? "" : "s"} whose latest answer was wrong. A question leaves the log as soon as you get it right. Click a row to see its history.`
            : `${list.matched} question${list.matched === 1 ? "" : "s"} shown so far. **Time spent** adds up every sitting, counting only while the question was on screen and you were active. Click a row to see its history.`
          : " "}
      </Text>

      {list && (
        <Table
          caption="Questions"
          columns={columns}
          rows={list.rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(historyHref(r.id))}
          empty={show === "mistakes" ? "No mistakes here. Nice." : "Nothing matches."}
        />
      )}
      {list && pager.pages > 1 && (
        <nav aria-label="Pages of questions" className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
          <Button
            variant="soft"
            size="sm"
            icon={<IconChevronLeft />}
            disabled={pager.page === 0}
            onClick={() => setPage(pager.page - 1)}
          >
            Previous
          </Button>
          <Text as="span" variant="small">
            {`Page ${pager.page + 1} of ${pager.pages} · ${pager.first}–${pager.last} of ${list.matched}`}
          </Text>
          <Button
            variant="soft"
            size="sm"
            iconAfter={<IconChevronRight />}
            disabled={pager.page >= pager.pages - 1}
            onClick={() => setPage(pager.page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
