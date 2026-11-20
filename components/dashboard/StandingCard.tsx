"use client";
// v1's "Where you stand": plan tasks done, questions answered, mocks taken, and a sentence about what's due.

import { Card, ProgressBar, StatTile, Text } from "@/components/ui";
import { PANEL } from "@/components/dashboard/kit";
import { useQuery } from "@/lib/db/client";
import type { IsoDate } from "@/lib/dates";
import { standingLine, topicsLine } from "@/lib/dashboard";

export function StandingCard({ today }: { today: IsoDate }) {
  const { data: s } = useQuery("dashboard.standing", { today });
  if (!s) return <Card className={PANEL} title="Where you stand" />;
  const pct = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
  return (
    <Card className={PANEL} title="Where you stand">
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
    </Card>
  );
}
