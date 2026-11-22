"use client";
// Stats → Overview: the totals, questions answered on each of the last 14 days, the strongest and weakest
// topics (docs/STATS.md §3) and every subject as a right / wrong bar. A subject opens Subjects & topics on it.

import { BarChart, Button, Card, HelpTip, ProgressRow, StatTile, Text, type Bar } from "@/components/ui";
import { formatShort } from "@/lib/dates";
import {
  MASTERED_STREAK,
  accuracy,
  avgTime,
  countsHint,
  formatDuration,
  formatPct,
  shares,
  strengthText,
  topicHref,
  type StatsSummary,
  type StatsTopic,
} from "@/lib/stats";

export function StatsOverview({
  data,
  onSubject,
  onMistakes,
}: {
  data: StatsSummary;
  onSubject: (id: string) => void;
  onMistakes: () => void;
}) {
  const t = data.totals;
  const answered = t.correct + t.incorrect;
  const week = data.days.slice(-7).reduce((n, d) => n + d.answered, 0);
  const bars: Bar[] = data.days.map((d, i) => ({
    key: d.day,
    label: d.day.slice(8).replace(/^0/, ""),
    value: d.answered,
    title: formatShort(d.day),
    highlight: i === data.days.length - 1,
    tip: d.answered
      ? `**${formatShort(d.day)}**: ${d.answered} answered, ${formatPct(accuracy(d.correct, d.answered - d.correct))} right, ${formatDuration(d.time_ms)}`
      : `**${formatShort(d.day)}**: nothing answered`,
  }));

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <StatTile value={answered} label={`answers (${t.skipped} skipped)`} tone="accent" />
        <StatTile value={formatPct(accuracy(t.correct, t.incorrect))} label="right" tone="green" />
        <StatTile value={`${t.tried} / ${t.total}`} label="questions tried" />
        <StatTile value={formatDuration(t.time_ms)} label="time on questions" />
        <StatTile value={formatDuration(avgTime(t))} label="average per answer" />
        <StatTile value={t.mastered} label={`mastered (${MASTERED_STREAK}+ right in a row)`} tone="green" />
        <StatTile value={t.mistakes} label="in the mistake log" tone="amber" />
      </div>

      <div className="grid items-start gap-5 min-[980px]:grid-cols-2">
        <Card
          title="Last 14 days"
          subtitle={`Questions answered each day · ${week} in the last 7 days. Hover a bar for its day.`}
        >
          <BarChart bars={bars} label="Questions answered each day" height={130} />
        </Card>

        <Card
          title={
            <>
              Strongest and weakest topics
              <HelpTip>
                {
                  "Strength is your accuracy with **recent answers counting more** (an answer counts half as much every 14 days) and **hard questions counting more** when right, easy ones more when wrong. A topic with few answers stays near your overall level. A topic is only called strong once you have tried at least 20% of its questions."
                }
              </HelpTip>
            </>
          }
          subtitle={data.overall === null ? undefined : `Your overall level: ${formatPct(data.overall * 100)}`}
        >
          <div className="grid gap-4">
            <TopicList
              title="Weakest"
              topics={data.weakest}
              empty="Answer a few questions to see where you are weak."
            />
            <TopicList
              title="Strongest"
              topics={data.strongest}
              empty="A topic shows here once you have tried at least 20% of its questions. A topic is never both weakest and strongest, so with few topics started this can stay empty."
            />
          </div>
        </Card>
      </div>

      <Card
        title="Subjects"
        subtitle="Each bar is the subject's questions by your latest answer. Green: right · red: wrong · grey: opened, not answered · blank: not seen yet. Click a subject to see its topics."
        actions={
          t.mistakes > 0 ? (
            <Button variant="soft" size="sm" onClick={onMistakes}>
              {`Open the mistake log (${t.mistakes})`}
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-0.5">
          {data.subjects.map((s) => (
            <ProgressRow
              key={s.id}
              title={s.name}
              end={
                s.shown
                  ? `**${formatPct(accuracy(s.correct, s.incorrect))}** · ${s.tried}/${s.total} tried · ${formatDuration(s.time_ms)}`
                  : `${s.total} q · not started`
              }
              {...shares(s)}
              hint={s.shown ? countsHint(s) : undefined}
              onClick={() => onSubject(s.id)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function TopicList({ title, topics, empty }: { title: string; topics: StatsTopic[]; empty: string }) {
  return (
    <div className="grid gap-1">
      <Text as="span" className="font-bold">
        {title}
      </Text>
      {topics.length === 0 ? (
        <Text variant="small">{empty}</Text>
      ) : (
        topics.map((x) => (
          <ProgressRow
            key={x.id}
            title={x.name}
            end={`**${strengthText(x.strength)}** · ${x.tried} of ${x.total} answered`}
            {...shares(x)}
            hint={`${x.subject_name} · ${countsHint(x)}`}
            href={topicHref(x)}
          />
        ))
      )}
    </div>
  );
}
