"use client";
// The Mocks tab (v1's): full-length mocks (fixed papers with their own timer), short tests built from the
// practice questions (subject, topic, weak topics, quick mixed) and the history of every attempt. Data: the
// `practice.mocks` and `mock.open` queries. Start opens the instructions page (/exam?mock=); a short test is
// built first (`mock.build`). History rows open the review (/practice/review?attempt=), or resume a test in progress.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Callout,
  Card,
  Dropdown,
  EmptyState,
  Heading,
  Pill,
  Table,
  Text,
  useToast,
  type Column,
  type PillTone,
} from "@/components/ui";
import { useMutation, useQuery } from "@/lib/db/client";
import type { BuiltKind } from "@/lib/exam";
import { groupBySubject, ratingOf, type MockCard, type MockHistoryRow } from "@/lib/practice";

const STATUS: Record<MockHistoryRow["status"], { label: string; tone: PillTone }> = {
  submitted: { label: "Submitted", tone: "green" },
  in_progress: { label: "In progress", tone: "blue" },
  abandoned: { label: "Abandoned", tone: "neutral" },
  failed: { label: "Failed", tone: "red" },
};

const introHref = (mockId: string) => `/exam?mock=${encodeURIComponent(mockId)}`;
const attemptHref = (a: Pick<MockHistoryRow, "id" | "status">) =>
  a.status === "in_progress"
    ? `/exam?attempt=${encodeURIComponent(a.id)}`
    : `/practice/review?attempt=${encodeURIComponent(a.id)}`;

/** "2 hours", "90 min". */
const duration = (minutes: number) =>
  minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}` : `${minutes} min`;
const num = (n: number) => String(Math.round(n * 100) / 100);
/** A stored time (ms) as an Indian-time date for the history; display only, no day logic. */
const when = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const HISTORY: Column<MockHistoryRow>[] = [
  { key: "name", header: "Test", cell: (a) => a.name, sortValue: (a) => a.name },
  { key: "date", header: "Date", cell: (a) => when(a.started_at), sortValue: (a) => a.started_at },
  { key: "qs", header: "Qs", cell: (a) => a.questions, align: "right", sortValue: (a) => a.questions },
  {
    key: "status",
    header: "Status",
    cell: (a) => <Pill tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Pill>,
  },
  {
    key: "score",
    header: "Score",
    align: "right",
    cell: (a) => (a.status === "submitted" && a.score !== null ? `${num(a.score)} / ${num(a.max_score ?? 0)}` : "—"),
    sortValue: (a) => a.score ?? -Infinity,
  },
  {
    key: "open",
    header: "",
    align: "right",
    cell: (a) => (
      <Button size="sm" variant={a.status === "in_progress" ? "primary" : "soft"} href={attemptHref(a)}>
        {a.status === "in_progress" ? "Resume" : "Review"}
      </Button>
    ),
  },
];

function FullMock({ mock, first, busy }: { mock: MockCard; first: boolean; busy: boolean }) {
  return (
    // the name is the card's title and the pills its actions, so the sparkle badge, name and time share one row
    <Card
      special={first}
      glow="low"
      title={mock.name}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={first ? "special" : "accent"}>{duration(mock.minutes)}</Pill>
          {mock.full_screen === 1 && <Pill tone="red">Full screen</Pill>}
          {mock.attempts > 0 && <Pill tone="green">{`${mock.attempts} attempt${mock.attempts === 1 ? "" : "s"}`}</Pill>}
        </div>
      }
    >
      <div className="grid content-start gap-3">
        <Text variant="small" block>
          {`${mock.questions} questions · ${num(mock.marks)} marks · ${mock.minutes} minutes. Its questions belong to this mock only.${mock.best !== null ? ` Best score **${num(mock.best)}**.` : ""}`}
        </Text>
        <div>
          <Button variant={first ? "special" : "primary"} disabled={busy} href={busy ? undefined : introHref(mock.id)}>
            {mock.attempts > 0 ? "Start again" : "Start"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function MocksTab() {
  const router = useRouter();
  const toast = useToast();
  const { data } = useQuery("practice.mocks");
  const { data: open } = useQuery("mock.open");
  const build = useMutation("mock.build");
  const [subject, setSubject] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);

  const groups = useMemo(() => groupBySubject(data?.topics ?? []), [data]);
  if (!data) return null;

  const subjectId = subject ?? groups[0]?.id ?? null;
  const topicId = topic ?? data.topics[0]?.id ?? null;
  const weak = data.topics.filter((t) => ratingOf(t.rating) !== "know").length;
  const canBuild = data.practiceQuestions > 0 && groups.length > 0;
  const busy = !!open; // one test at a time

  const startBuilt = (kind: BuiltKind, ids?: { subjectId?: string; topicId?: string }) => async () => {
    const id = await build.run({ kind, ...ids });
    if (id) router.push(introHref(id));
    else if (id === null) toast("No practice questions match that test yet.", "error");
  };

  return (
    <div className="grid gap-8">
      {open && (
        <Callout tone="warn" title="A test is in progress">
          {`**${open.name}** hasn't been finished. Resume it, or open it and quit, before starting another.`}
          <div className="mt-2.5">
            <Button variant="primary" href={`/exam?attempt=${encodeURIComponent(open.id)}`}>
              Resume
            </Button>
          </div>
        </Callout>
      )}

      <Callout tone="caution" title="CAUTION: some mocks run in full screen">
        In a mock marked **Full screen**, pressing Esc, switching tabs or windows, or refreshing leaves full screen. The
        first time you get a warning; the second time the test ends and is marked **failed**. The timer keeps running
        while you are away. Treat it like the real exam.
      </Callout>

      <section className="grid gap-3.5">
        <div>
          <Heading level={2}>Full-length mocks</Heading>
          <Text variant="small">Complete papers with their own fixed questions, sections and timer.</Text>
        </div>
        {data.mocks.length === 0 ? (
          <EmptyState icon="⏱️" title="No full-length mocks yet">
            Your file has mock-only questions but no paper that uses them. Load a mock test file to see it here.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4">
            {data.mocks.map((m, i) => (
              <div
                key={m.id}
                className="animate-card-in [animation-fill-mode:both]"
                style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
              >
                <FullMock mock={m} first={i === 0} busy={busy} />
              </div>
            ))}
          </div>
        )}
      </section>

      {canBuild && (
        <section className="grid gap-3.5">
          <div>
            <Heading level={2}>Subject and topic tests</Heading>
            <Text variant="small">
              Short tests built from your practice questions. Questions you haven&apos;t answered come first.
            </Text>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4">
            <Card title="Subject test" subtitle="Up to 20 questions from one subject.">
              <div className="grid gap-3">
                <Dropdown
                  label="Subject"
                  value={subjectId}
                  onChange={setSubject}
                  options={groups.map((g) => ({ value: g.id, label: g.name }))}
                />
                <div>
                  <Button
                    variant="primary"
                    disabled={busy || !subjectId}
                    loading={build.pending}
                    onClick={startBuilt("subject", { subjectId: subjectId ?? undefined })}
                  >
                    Start
                  </Button>
                </div>
              </div>
            </Card>
            <Card title="Topic test" subtitle="Up to 10 questions from one topic.">
              <div className="grid gap-3">
                <Dropdown
                  label="Topic"
                  searchable
                  value={topicId}
                  onChange={setTopic}
                  options={data.topics.map((t) => ({ value: t.id, label: t.name, group: t.subject_name }))}
                />
                <div>
                  <Button
                    variant="primary"
                    disabled={busy || !topicId}
                    loading={build.pending}
                    onClick={startBuilt("topic", { topicId: topicId ?? undefined })}
                  >
                    Start
                  </Button>
                </div>
              </div>
            </Card>
            {weak > 0 && (
              <Card title="Weak-topics test" subtitle={`Only your “No idea” and “Shaky” topics (${weak}).`}>
                <Button variant="primary" disabled={busy} loading={build.pending} onClick={startBuilt("weak")}>
                  Start weak-topics test
                </Button>
              </Card>
            )}
            <Card title="Quick mixed test" subtitle="About 15 questions drawn from every subject.">
              <Button variant="primary" disabled={busy} loading={build.pending} onClick={startBuilt("quick")}>
                Start quick test
              </Button>
            </Card>
          </div>
        </section>
      )}

      <Card title="History">
        <Table
          columns={HISTORY}
          rows={data.history}
          rowKey={(a) => a.id}
          empty="No attempts yet. Your scores will be listed here."
        />
      </Card>
    </div>
  );
}
