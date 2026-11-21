"use client";
// The topic practice screen: /practice/session?topic=<id>. One question at a time with Previous / Next, a
// palette to jump around, and a progress bar. Each answer is stored when you check it (`question.record`);
// questions you opened and never answered are stored as skipped when you finish or leave, so their time counts
// (docs/STATS.md). Only the first check of a question counts in a sitting; "Try again" is just for practice.
// Rules: lib/session.ts; the clock: components/utils/useSittingClock.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnyQuestion, QuestionPalette } from "@/components/question";
import { Button, Card, EmptyState, Heading, Pill, ProgressBar, StatTile, Text } from "@/components/ui";
import { IconChevronLeft, IconChevronRight, IconRefresh } from "@/components/icons";
import { useSittingClock } from "@/components/utils/useSittingClock";
import { useMutation, useQuery } from "@/lib/db/client";
import type { Verdict } from "@/lib/grade";
import { outcomeOf, paletteState, pendingSkips, startIndex, summarize } from "@/lib/session";
import type { AnswerOutcome } from "@/types/tables";

const BACK = "/practice?tab=topics";

/** Reads the topic from the address; "Practise again" starts a fresh sitting by remounting it. */
export function PracticeSessionScreen() {
  const topicId = useSearchParams().get("topic");
  const [round, setRound] = useState(0);
  if (!topicId) return <Missing />;
  return <Sitting key={`${topicId}:${round}`} topicId={topicId} onAgain={() => setRound((r) => r + 1)} />;
}

function Missing() {
  return (
    <EmptyState icon="🧭" title="No topic chosen" action={<Button href={BACK}>Back to Practice</Button>}>
      Pick a topic on the Practice page to start.
    </EmptyState>
  );
}

function Sitting({ topicId, onAgain }: { topicId: string; onAgain: () => void }) {
  const { data } = useQuery("question.topic", { topicId });
  const record = useMutation("question.record");
  const [at, setAt] = useState<number | null>(null); // null = not moved yet: open on the first untried question
  const [visited, setVisited] = useState<string[]>([]); // opened this sitting, in order (palette + kept mounted)
  const [outcomes, setOutcomes] = useState<Record<string, AnswerOutcome>>({});
  const [finished, setFinished] = useState(false);

  const items = data?.items ?? [];
  const index = Math.min(at ?? startIndex(items), Math.max(0, items.length - 1));
  const currentId = items[index]?.question.id ?? null;
  const timeOf = useSittingClock(finished ? null : currentId);

  // What the end-of-sitting write needs, kept in refs so it always sees the latest values.
  const written = useRef(new Set<string>()); // questions already stored this sitting
  const opened = useRef<string[]>([]);
  const timeRef = useRef(timeOf);
  timeRef.current = timeOf;
  const runRef = useRef(record.run);
  runRef.current = record.run;

  useEffect(() => {
    if (!currentId || opened.current.includes(currentId)) return;
    opened.current.push(currentId);
    setVisited([...opened.current]);
  }, [currentId]);

  /** Stores every opened question that was never answered as skipped, with its time. */
  const flush = useCallback(() => {
    const answers = pendingSkips(opened.current, written.current).map((questionId) => ({
      questionId,
      outcome: "skipped" as const,
      timeMs: timeRef.current(questionId),
    }));
    for (const a of answers) written.current.add(a.questionId);
    if (answers.length) void runRef.current({ answers });
  }, []);

  // Leaving the page ends the sitting. In dev, React mounts, unmounts and remounts a component once: the
  // check after a tick sees the remount and does nothing.
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      setTimeout(() => {
        if (!alive.current) flush();
      }, 0);
    };
  }, [flush]);

  const answer = (id: string) => (verdict: Verdict) => {
    if (written.current.has(id)) return; // only the first check of a question counts
    written.current.add(id);
    const outcome = outcomeOf(verdict);
    setOutcomes((o) => ({ ...o, [id]: outcome }));
    void record.run({ answers: [{ questionId: id, outcome, timeMs: timeOf(id) }] });
  };

  if (!data) return null;
  if (!data.topic || items.length === 0)
    return (
      <EmptyState icon="🔎" title="Nothing to practise here" action={<Button href={BACK}>Back to Practice</Button>}>
        This topic has no practice questions (code questions are on the Programming tab).
      </EmptyState>
    );

  const total = items.length;
  const done = Object.keys(outcomes).length;

  if (finished) {
    const s = summarize(outcomes, total);
    return (
      <div className="mx-auto grid max-w-[640px] gap-5">
        <Card title="Sitting finished" subtitle={`${data.topic.subject_name}: ${data.topic.name}`} special glow="low">
          <div className="grid gap-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
              <StatTile value={s.answered} label={`answered of ${s.total}`} tone="accent" />
              <StatTile value={s.right} label="right" tone="green" />
              <StatTile value={s.wrong} label="wrong" tone="amber" />
              <StatTile value={s.accuracy === null ? "—" : `${s.accuracy}%`} label="accuracy" />
            </div>
            <Text variant="small">
              {s.unanswered > 0
                ? `${s.unanswered} question${s.unanswered === 1 ? "" : "s"} left unanswered. Practise again to pick them up first.`
                : "Every question answered."}
            </Text>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="primary" href={BACK}>
                Back to Practice
              </Button>
              <Button variant="soft" icon={<IconRefresh />} onClick={onAgain}>
                Practise again
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const states = items.map((x) => paletteState(outcomes[x.question.id], visited.includes(x.question.id)));
  const last = index === total - 1;
  const finish = () => {
    flush();
    setFinished(true);
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button href={BACK} variant="ghost" size="sm" icon={<IconChevronLeft />}>
          Practice
        </Button>
        <Heading level={1}>{data.topic.name}</Heading>
        <Pill tone="neutral">{data.topic.subject_name}</Pill>
        <Button variant="secondary" className="ml-auto" onClick={finish}>
          Finish
        </Button>
      </div>

      <div className="grid items-start gap-5 min-[980px]:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4">
          {/* above the question, so Previous / Next stay put whatever the question's height */}
          <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
            <div className="max-w-[420px] min-w-[200px] flex-1">
              <ProgressBar label={`${done} of ${total} answered`} value={done} max={total} tone="green" />
            </div>
            <div className="flex gap-2.5">
              <Button variant="soft" icon={<IconChevronLeft />} disabled={index === 0} onClick={() => setAt(index - 1)}>
                Previous
              </Button>
              {last ? (
                <Button variant="primary" onClick={finish}>
                  Finish
                </Button>
              ) : (
                <Button variant="primary" iconAfter={<IconChevronRight />} onClick={() => setAt(index + 1)}>
                  Next
                </Button>
              )}
            </div>
          </div>
          {/* opened questions stay mounted (hidden), so going back keeps your answer and the verdict */}
          {items.map((x, i) =>
            visited.includes(x.question.id) || i === index ? (
              <div key={x.question.id} hidden={i !== index}>
                <AnyQuestion question={x.question} detail={x.detail} number={i + 1} onAnswer={answer(x.question.id)} />
              </div>
            ) : null,
          )}
        </div>

        <Card title="Questions" className="min-[980px]:sticky min-[980px]:top-6">
          <QuestionPalette states={states} current={index} onJump={setAt} />
        </Card>
      </div>
    </div>
  );
}
