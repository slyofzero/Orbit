"use client";
// The practice screens: /practice/session?topic=<id>, or ?q=<question id> for a sitting of just that one question
// (Manage pack's Questions table opens a row this way), and /practice/day?date=<YYYY-MM-DD> for a plan day's linked
// questions, then the bonus ones carried into it, set apart in amber (the main event's "Practise these questions"). One question at a time with Previous / Next, a
// palette to jump around, and a progress bar. Each answer is stored when you check it (`question.record`), and the
// question's clock stops right then; a right answer moves on to the next question by itself (a wrong one stays, so
// you can read the explanation). Questions you opened and never answered are stored as skipped when you finish or
// leave, so their time counts (docs/STATS.md). "Try again" is a new attempt: one more showing of the question, its
// clock starts from 0, and it is stored again when you answer (or as skipped if you leave it unanswered).
// Rules: lib/session.ts; the clock: components/utils/useSittingClock.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnyQuestion, QuestionPalette } from "@/components/question";
import { Button, Card, EmptyState, Heading, Pill, ProgressBar, StatTile, Text } from "@/components/ui";
import { IconChevronLeft, IconChevronRight, IconRefresh } from "@/components/icons";
import { EditQuestionHost } from "@/components/manage/EditQuestionHost";
import { useSittingClock } from "@/components/utils/useSittingClock";
import { useMutation, useQuery } from "@/lib/db/client";
import { formatShort, isIsoDate, todayIST, type IsoDate } from "@/lib/dates";
import type { Verdict } from "@/lib/grade";
import type { TopicQuestions } from "@/lib/questions";
import { AUTO_NEXT_MS, autoNext, outcomeOf, paletteState, pendingSkips, startIndex, summarize } from "@/lib/session";
import { announce } from "@/components/companion";
import type { AnswerOutcome } from "@/types/tables";

type Back = { href: string; label: string };
const TOPICS: Back = { href: "/practice?tab=topics", label: "Practice" };
const PLANNER: Back = { href: "/planner", label: "Planner" };

/** Reads the topic from the address; "Practise again" starts a fresh sitting by remounting it. */
export function PracticeSessionScreen() {
  const params = useSearchParams();
  const topicId = params.get("topic");
  const questionId = params.get("q");
  const [round, setRound] = useState(0);
  if (!topicId && !questionId)
    return (
      <EmptyState icon="🧭" title="No topic chosen" action={<Button href={TOPICS.href}>Back to Practice</Button>}>
        Pick a topic on the Practice page to start.
      </EmptyState>
    );
  return (
    <TopicSitting
      key={`${topicId}:${questionId}:${round}`}
      topicId={topicId}
      questionId={questionId}
      onAgain={() => setRound((r) => r + 1)}
    />
  );
}

function TopicSitting(p: { topicId: string | null; questionId: string | null; onAgain: () => void }) {
  const { data } = useQuery("question.topic", { topicId: p.topicId, questionId: p.questionId });
  return (
    <Sitting
      data={data}
      back={TOPICS}
      onAgain={p.onAgain}
      empty={
        p.questionId
          ? "This question isn't a practice question any more (it was deleted, or moved out of this topic or bank)."
          : "This topic has no practice questions (code questions are on the Programming tab)."
      }
    />
  );
}

/** /practice/day?date=: the day's linked questions, then its bonus (carried-over) ones. */
export function DayPracticeScreen() {
  const raw = useSearchParams().get("date");
  const date = raw && isIsoDate(raw) ? raw : null;
  const [round, setRound] = useState(0);
  if (!date)
    return (
      <EmptyState icon="🧭" title="No day chosen" action={<Button href={PLANNER.href}>Back to Planner</Button>}>
        Open a day on the planner or the dashboard and press **Practise these questions**.
      </EmptyState>
    );
  return <DaySitting key={`${date}:${round}`} date={date} onAgain={() => setRound((r) => r + 1)} />;
}

function DaySitting({ date, onAgain }: { date: IsoDate; onAgain: () => void }) {
  const [today] = useState(todayIST);
  const { data } = useQuery("question.day", { date, today });
  return (
    <Sitting
      data={data}
      back={PLANNER}
      onAgain={onAgain}
      bonus={data?.bonus}
      empty={
        data?.topic
          ? "No questions are linked to this day, and none were carried over to it. Link some with Link questions on the Planner."
          : "This date isn't a day of your plan."
      }
    />
  );
}

function Sitting({
  data,
  back,
  onAgain,
  empty,
  bonus = {},
}: {
  data: TopicQuestions | undefined;
  back: Back;
  onAgain: () => void;
  /** what the empty state says */
  empty: string;
  /** the day page's bonus questions (carried over): question id → the day it came from. They come last. */
  bonus?: Record<string, IsoDate>;
}) {
  const record = useMutation("question.record");
  const [at, setAt] = useState<number | null>(null); // null = not moved yet: open on the first untried question
  const [visited, setVisited] = useState<string[]>([]); // opened this sitting, in order (palette + kept mounted)
  const [outcomes, setOutcomes] = useState<Record<string, AnswerOutcome>>({});
  const [finished, setFinished] = useState(false);

  const items = data?.items ?? [];
  const index = Math.min(at ?? startIndex(items), Math.max(0, items.length - 1));
  const currentId = items[index]?.question.id ?? null;
  const { timeOf, freeze, restart } = useSittingClock(finished ? null : currentId);
  const indexRef = useRef(index);
  indexRef.current = index;

  // What the end-of-sitting write needs, kept in refs so it always sees the latest values.
  const written = useRef(new Set<string>()); // questions whose current attempt is stored
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

  const answer = (id: string, i: number) => (verdict: Verdict) => {
    if (written.current.has(id)) return; // one stored answer per attempt
    written.current.add(id);
    freeze(id); // the time stops once it is answered
    const outcome = outcomeOf(verdict);
    setOutcomes((o) => ({ ...o, [id]: outcome }));
    void record.run({ answers: [{ questionId: id, outcome, timeMs: timeOf(id) }] });
    announce(outcome === "correct" ? "right" : "wrong");
    const next = autoNext(outcome, i, items.length);
    if (next !== null)
      setTimeout(() => {
        if (alive.current && indexRef.current === i) setAt(next); // only if you are still on it
      }, AUTO_NEXT_MS);
  };

  /** Try again: a new attempt, stored again when answered (or as skipped when left), with a fresh clock. */
  const retry = (id: string) => () => {
    written.current.delete(id);
    restart(id);
    setOutcomes(({ [id]: _, ...rest }) => rest);
  };

  if (!data) return null;
  if (!data.topic || items.length === 0)
    return (
      <div className="grid gap-5">
        <EmptyState
          icon="🔎"
          title="Nothing to practise here"
          action={<Button href={back.href}>{`Back to ${back.label}`}</Button>}
        >
          {empty}
        </EmptyState>
      </div>
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
              <Button variant="primary" href={back.href}>
                {`Back to ${back.label}`}
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
  // bonus questions come after the day's own: [0, split) own, [split, total) bonus
  const firstBonus = items.findIndex((x) => bonus[x.question.id]);
  const split = firstBonus < 0 ? total : firstBonus;
  const last = index === total - 1;
  const finish = () => {
    flush();
    announce("progress");
    setFinished(true);
  };

  return (
    <EditQuestionHost>
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button href={back.href} variant="ghost" size="sm" icon={<IconChevronLeft />}>
            {back.label}
          </Button>
          <Heading level={1}>{data.topic.name}</Heading>
          <Pill tone="neutral">{data.topic.subject_name}</Pill>
          {split < total && <Pill tone="amber">{`+ ${total - split} bonus`}</Pill>}
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
                <Button
                  variant="soft"
                  icon={<IconChevronLeft />}
                  disabled={index === 0}
                  onClick={() => setAt(index - 1)}
                >
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
                <div key={x.question.id} hidden={i !== index} className="grid gap-2.5">
                  {bonus[x.question.id] && (
                    <div>
                      <Pill tone="amber">{`Bonus · carried over from ${formatShort(bonus[x.question.id])}`}</Pill>
                    </div>
                  )}
                  <AnyQuestion
                    question={x.question}
                    detail={x.detail}
                    number={i + 1}
                    onAnswer={answer(x.question.id, i)}
                    onRetry={retry(x.question.id)}
                  />
                </div>
              ) : null,
            )}
          </div>

          <Card title="Questions" className="min-[980px]:sticky min-[980px]:top-6">
            <div className="grid gap-4">
              {split > 0 && (
                <QuestionPalette
                  states={states.slice(0, split)}
                  current={index < split ? index : -1}
                  onJump={setAt}
                  label={split < total ? "This day's questions" : "Questions"}
                />
              )}
              {split < total && (
                <div className="grid gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-amber bg-amber/8 px-3 py-2.5">
                  <Text as="div" className="text-amber">
                    {`**Bonus** · carried over from earlier days`}
                  </Text>
                  <QuestionPalette
                    states={states.slice(split)}
                    start={split + 1}
                    current={index >= split ? index - split : -1}
                    onJump={(i) => setAt(split + i)}
                    label="Bonus questions"
                  />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </EditQuestionHost>
  );
}
