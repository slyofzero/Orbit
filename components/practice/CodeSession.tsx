"use client";
// The Programming screen: /practice/code?id=<question id>. One code question on a page of its own (v1): the
// statement beside the editor on wide screens, "I got it right / wrong" to mark it yourself, and Previous / Next
// through the Programming list. Marking stores one answer (`question.record`) with the question's active time
// (docs/STATS.md); leaving without marking stores it as skipped, so the time still counts. Only the first mark per
// visit counts; "Try again" is for practice. Each question is its own sitting (the page remounts per question).

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CodeQuestion } from "@/components/question";
import { Button, EmptyState, Pill, Text } from "@/components/ui";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { EditQuestionHost } from "@/components/manage/EditQuestionHost";
import { useSittingClock } from "@/components/utils/useSittingClock";
import { useMutation, useQuery } from "@/lib/db/client";
import type { Verdict } from "@/lib/grade";
import type { QuestionCodeRow } from "@/types/tables";
import { outcomeOf } from "@/lib/session";

const BACK = "/practice?tab=programming";
const href = (id: string) => `/practice/code?id=${encodeURIComponent(id)}`;

/** Reads the question from the address; a new question remounts the sitting (so the last one is stored). */
export function CodeSessionScreen() {
  const id = useSearchParams().get("id");
  if (!id)
    return (
      <EmptyState icon="🧭" title="No question chosen" action={<Button href={BACK}>Back to Programming</Button>}>
        Pick a question on the Programming tab to start.
      </EmptyState>
    );
  return <CodeSitting key={id} id={id} />;
}

function CodeSitting({ id }: { id: string }) {
  const { data } = useQuery("question.code", { id });
  const record = useMutation("question.record");
  const [verdict, setVerdict] = useState<Verdict | undefined>(undefined);
  const ready = !!data?.item;
  const timeOf = useSittingClock(ready ? id : null);

  // What the end-of-visit write needs, in refs so it sees the latest values.
  const written = useRef(false);
  const timeRef = useRef(timeOf);
  timeRef.current = timeOf;
  const runRef = useRef(record.run);
  runRef.current = record.run;
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const flush = useCallback(() => {
    if (written.current || !readyRef.current) return;
    written.current = true;
    void runRef.current({ answers: [{ questionId: id, outcome: "skipped", timeMs: timeRef.current(id) }] });
  }, [id]);

  // Leaving the question ends the visit. In dev React mounts, unmounts and remounts once: the check after a
  // tick sees the remount and does nothing.
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

  const answer = (v: Verdict) => {
    setVerdict(v);
    if (written.current) return; // only the first mark of a visit counts
    written.current = true;
    void record.run({ answers: [{ questionId: id, outcome: outcomeOf(v), timeMs: timeOf(id) }] });
  };

  if (!data) return null;
  if (!data.item)
    return (
      <EmptyState icon="🔎" title="That question isn't here" action={<Button href={BACK}>Back to Programming</Button>}>
        It may have been removed. Pick another one on the Programming tab.
      </EmptyState>
    );

  const { question, detail, latest } = data.item;
  const solved = verdict === "correct" || (verdict === undefined && latest === "correct");
  return (
    <EditQuestionHost>
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button href={BACK} variant="ghost" size="sm" icon={<IconChevronLeft />}>
            Programming
          </Button>
          <Text variant="small" as="span">{`Question ${data.index + 1} of ${data.total}`}</Text>
          {data.topic && <Pill tone="neutral">{`${data.topic.subject_name}: ${data.topic.name}`}</Pill>}
          {solved && <Pill tone="green">✓ Solved</Pill>}
          <div className="ml-auto flex gap-2.5">
            <Button
              variant="soft"
              icon={<IconChevronLeft />}
              disabled={!data.prev}
              href={data.prev ? href(data.prev) : undefined}
            >
              Previous
            </Button>
            <Button
              variant="primary"
              iconAfter={<IconChevronRight />}
              disabled={!data.next}
              href={data.next ? href(data.next) : undefined}
            >
              Next
            </Button>
          </div>
        </div>
        <CodeQuestion question={question} detail={detail as QuestionCodeRow} onAnswer={answer} split rows={18} />
      </div>
    </EditQuestionHost>
  );
}
