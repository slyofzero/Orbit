"use client";
// v1's "Where you stand": plan tasks done, questions answered, mocks taken, and a sentence about what's due, plus
// three rows: right vs wrong answers, how you rate your topics (know / shaky / new / not rated) and your best mock.
// The card fills the row it shares with Milestones, so the two match in height.

import { cx } from "@/components/utils/cx";
import { Card, ProgressBar, ProgressRow, StatTile, Text } from "@/components/ui";
import { PANEL } from "@/components/dashboard/kit";
import { useQuery } from "@/lib/db/client";
import type { IsoDate } from "@/lib/dates";
import { standingLine, topicsLine } from "@/lib/dashboard";

const pctOf = (n: number, of: number) => (of ? (100 * n) / of : 0);

export function StandingCard({ today }: { today: IsoDate }) {
  const { data: s } = useQuery("dashboard.standing", { today });
  if (!s) return <Card className={PANEL} title="Where you stand" />;
  const pct = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
  const rated = s.known + s.shaky + s.fresh;
  return (
    <Card className={cx(PANEL, "overflow-y-auto")} title="Where you stand">
      <div className="grid grid-cols-3 gap-2.5 max-[420px]:grid-cols-1">
        <StatTile tone="accent" value={String(s.tasksDone)} label={`of ${s.tasksTotal} plan tasks`} />
        <StatTile
          tone="green"
          value={String(s.answered)}
          label={s.answered ? `questions, ${pct}% right` : "questions"}
        />
        <StatTile tone="amber" value={String(s.mocks)} label={s.mocks === 1 ? "mock taken" : "mocks taken"} />
      </div>
      <div className="mt-3.5 mb-2">
        <ProgressBar label="Plan tasks done" showLabel={false} value={s.tasksDone} max={s.tasksTotal} tone="green" />
      </div>
      <Text variant="hint">
        {[standingLine(s), topicsLine({ topics: s.topics, fresh: s.fresh, shaky: s.shaky })].join(" ").trim()}
      </Text>
      <div className="mt-4 grid gap-1.5">
        <ProgressRow
          title="Answers"
          end={s.answered ? `${s.correct} right · ${s.answered - s.correct} wrong` : "none yet"}
          good={pctOf(s.correct, s.answered)}
          bad={pctOf(s.answered - s.correct, s.answered)}
        />
        <ProgressRow
          title="Topics you know"
          end={s.topics ? `${s.known} of ${s.topics} · ${s.topics - rated} not rated` : "no topics yet"}
          good={pctOf(s.known, s.topics)}
          bad={pctOf(s.fresh, s.topics)}
          skipped={pctOf(s.shaky, s.topics)}
          hint="Green: know · grey: shaky · red: no idea. Rate topics in Manage pack."
        />
        <ProgressRow
          title="Best mock"
          end={s.bestMock === null ? "none taken" : `${s.bestMock}%`}
          good={s.bestMock ?? 0}
        />
      </div>
    </Card>
  );
}
