"use client";
// The review of a mock attempt (/practice/review?attempt=<id>): the score, a table per section, the palette
// (right / wrong / not answered / not visited) and every question locked with your answer, the correct one, the
// explanation and the marks. Grades are worked out again from the saved responses (lib/exam.ts gradeResponse),
// so failed and abandoned attempts can be looked through too, though only submitted ones are scored.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExamQuestion, QuestionPalette } from "@/components/question";
import {
  Button,
  Callout,
  Card,
  EmptyState,
  Heading,
  Pill,
  StatTile,
  Table,
  Text,
  type PillTone,
} from "@/components/ui";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { MOCKS } from "@/components/exam/ExamIntro";
import { useQuery } from "@/lib/db/client";
import { gradeResponse, isScored } from "@/lib/exam";
import type { PaletteState } from "@/lib/session";
import type { AttemptStatus } from "@/types/tables";

const STATUS: Record<AttemptStatus, { label: string; tone: PillTone }> = {
  submitted: { label: "Submitted", tone: "green" },
  in_progress: { label: "In progress", tone: "blue" },
  abandoned: { label: "Abandoned", tone: "neutral" },
  failed: { label: "Failed", tone: "red" },
};
const num = (n: number) => String(Math.round(n * 100) / 100);
/** "1 h 12 min", "8 min", "40 s" */
function spent(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}
/** A stored time (ms) as an Indian-time date and time; display only, no day logic. */
const when = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function AttemptReview({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const { data } = useQuery("mock.attempt", { attemptId });
  const [at, setAt] = useState(0);
  const status = data?.attempt?.status;

  useEffect(() => {
    if (status === "in_progress") router.replace(`/exam?attempt=${encodeURIComponent(attemptId)}`);
  }, [status, router, attemptId]);

  const graded = useMemo(
    () => (data?.items ?? []).map((x) => ({ ...x, grade: gradeResponse(x.question, x.detail, x.item) })),
    [data],
  );

  if (!data) return null;
  if (!data.attempt)
    return (
      <EmptyState icon="🔎" title="That attempt isn't here" action={<Button href={MOCKS}>Back to Mocks</Button>}>
        It may have been deleted.
      </EmptyState>
    );
  if (status === "in_progress") return null;

  const a = data.attempt;
  const scored = graded.filter((g) => isScored(g.question.type));
  const right = scored.filter((g) => g.grade.verdict === "correct").length;
  const wrong = scored.filter((g) => g.grade.verdict === "incorrect").length;
  const answered = right + wrong;
  const time = graded.reduce((n, g) => n + g.item.time_ms, 0);
  const states: PaletteState[] = graded.map((g) =>
    g.grade.verdict === "correct" && g.grade.marks !== null
      ? "right"
      : g.grade.verdict === "incorrect"
        ? "wrong"
        : g.item.visited
          ? "seen"
          : "new",
  );
  const sections = a.sections.map((s, k) => {
    const rows = graded.filter((g) => g.item.section === k);
    const sc = rows.filter((g) => isScored(g.question.type));
    return {
      name: s.name,
      questions: rows.length,
      right: sc.filter((g) => g.grade.verdict === "correct").length,
      wrong: sc.filter((g) => g.grade.verdict === "incorrect").length,
      marks: sc.reduce((n, g) => n + (g.grade.marks ?? 0), 0),
      max: sc.reduce((n, g) => n + g.question.marks, 0),
    };
  });
  const index = Math.min(at, graded.length - 1);
  const cur = graded[index];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button href={MOCKS} variant="ghost" size="sm" icon={<IconChevronLeft />}>
          Mocks
        </Button>
        <Heading level={1}>{data.mock?.name ?? "Mock test"}</Heading>
        <Pill tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Pill>
        <Text variant="small" as="span">
          {when(a.started_at)}
        </Text>
        {data.mock && (
          <Button variant="soft" className="ml-auto" href={`/exam?mock=${encodeURIComponent(data.mock.id)}`}>
            Take it again
          </Button>
        )}
      </div>

      {a.status === "failed" && (
        <Callout tone="caution" title="CAUTION: this test failed">
          {`${a.failed_reason ?? "A rule of the test was broken."} It is not scored and its answers don't count in your stats. You can still look through it below.`}
        </Callout>
      )}
      {a.status === "abandoned" && (
        <Callout tone="info" title="You quit this test">
          It is not scored and its answers don&apos;t count in your stats. You can still look through it below.
        </Callout>
      )}

      {a.status === "submitted" && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
          <StatTile value={`${num(a.score ?? 0)} / ${num(a.max_score ?? 0)}`} label="score" tone="accent" />
          <StatTile value={right} label="right" tone="green" />
          <StatTile value={wrong} label="wrong" tone="amber" />
          <StatTile value={scored.length - answered} label="not answered" />
          <StatTile value={answered ? `${Math.round((right / answered) * 100)}%` : "—"} label="accuracy" />
          <StatTile value={spent(time)} label="time on questions" />
        </div>
      )}

      {a.status === "submitted" && sections.length > 1 && (
        <Table
          caption="Score by section"
          columns={[
            { key: "s", header: "Section", cell: (r) => r.name },
            { key: "q", header: "Questions", align: "right", cell: (r) => r.questions },
            { key: "r", header: "Right", align: "right", cell: (r) => r.right },
            { key: "w", header: "Wrong", align: "right", cell: (r) => r.wrong },
            { key: "m", header: "Marks", align: "right", cell: (r) => `${num(r.marks)} / ${num(r.max)}` },
          ]}
          rows={sections}
          rowKey={(r) => r.name}
        />
      )}

      {cur && (
        <div className="grid items-start gap-5 min-[980px]:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid gap-4">
            <div className="flex justify-end gap-2.5">
              <Button variant="soft" icon={<IconChevronLeft />} disabled={index === 0} onClick={() => setAt(index - 1)}>
                Previous
              </Button>
              <Button
                variant="primary"
                iconAfter={<IconChevronRight />}
                disabled={index === graded.length - 1}
                onClick={() => setAt(index + 1)}
              >
                Next
              </Button>
            </div>
            <ExamQuestion
              key={cur.question.id}
              question={cur.question}
              detail={cur.detail}
              number={index + 1}
              response={cur.item}
              review={cur.grade}
            />
            {!cur.item.visited && <Text variant="hint">You didn&apos;t open this question during the test.</Text>}
          </div>
          <Card title="Questions" className="min-[980px]:sticky min-[980px]:top-6">
            <QuestionPalette states={states} current={index} onJump={setAt} />
          </Card>
        </div>
      )}
    </div>
  );
}
