"use client";
// The mock exam screen (/exam?attempt=<id>), copying a real computer-based test: the name and the timer at the
// top, section tabs, one question at a time, the five-colour palette, and Save & Next / Mark for review & Next /
// Clear response. Jumping, Back and Next do NOT save the answer on screen (only the two save buttons do).
// Everything is saved to the attempt as you go (`mock.save`), so a refresh resumes where you were. Each
// question's clock runs only while it is on screen (docs/STATS.md §2). Submit grades it (`mock.submit`) and opens
// the review. A full-screen mock warns the first time full screen is left and fails the second time
// (lib/exam.ts ALLOWED_WARNINGS). There is deliberately no Esc shortcut here.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExamQuestion, QuestionPalette } from "@/components/question";
import { Button, Card, Dialog, EmptyState, ExamTimer, Heading, Pill, Table, Tabs, Text } from "@/components/ui";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { enterFullScreen, exitFullScreen, inFullScreen } from "@/components/exam/fullScreen";
import { MOCKS } from "@/components/exam/ExamIntro";
import { Page } from "@/components/app/Page";
import { useSittingClock } from "@/components/utils/useSittingClock";
import { useMutation, useQuery } from "@/lib/db/client";
import {
  ALLOWED_WARNINGS,
  NO_RESPONSE,
  countStatuses,
  examStatus,
  timeLeftMs,
  type AttemptData,
  type ExamResponse,
  type ExamStatus,
} from "@/lib/exam";

const reviewHref = (id: string) => `/practice/review?attempt=${encodeURIComponent(id)}`;
/** Attempts already warned for opening outside full screen in this page load (React runs effects twice in dev). */
const warnedOnLoad = new Set<string>();

export function ExamScreen({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const { data } = useQuery("mock.attempt", { attemptId });
  const status = data?.attempt?.status;

  // Opening a test that had already ended goes to its review. A test that ends on this screen (submit, quit,
  // fail) navigates by itself, so this must not race it: only the status seen when the page opened counts.
  const firstStatus = useRef<string | null>(null);
  if (status && firstStatus.current === null) firstStatus.current = status;
  useEffect(() => {
    if (firstStatus.current && firstStatus.current !== "in_progress") router.replace(reviewHref(attemptId));
  }, [status, router, attemptId]);
  useEffect(() => {
    if (status && status !== "in_progress") exitFullScreen();
  }, [status]);

  if (!data) return null;
  if (!data.attempt || !data.mock)
    return (
      <Page>
        <EmptyState icon="🔎" title="That test isn't here" action={<Button href={MOCKS}>Back to Mocks</Button>}>
          It may have been deleted. Start another one on the Mocks tab.
        </EmptyState>
      </Page>
    );
  // Never a blank page: while the next page loads (or if it can't), say where things stand.
  if (status !== "in_progress")
    return (
      <Page>
        <EmptyState
          icon="🏁"
          title="This test has ended"
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button variant="primary" href={reviewHref(attemptId)}>
                See the review
              </Button>
              <Button variant="soft" href={MOCKS}>
                Back to Mocks
              </Button>
            </div>
          }
        >
          {status === "abandoned"
            ? "You quit it, so it isn't scored."
            : status === "failed"
              ? "It failed, so it isn't scored."
              : "It has been submitted."}
        </EmptyState>
      </Page>
    );
  return <Running data={data as Loaded} />;
}

type Loaded = { attempt: NonNullable<AttemptData["attempt"]>; mock: NonNullable<AttemptData["mock"]> } & AttemptData;

function Running({ data }: { data: Loaded }) {
  const router = useRouter();
  const { attempt, mock, items } = data;
  const id = attempt.id;
  const save = useMutation("mock.save");
  const submitM = useMutation("mock.submit");
  const endM = useMutation("mock.end");
  const warnM = useMutation("mock.warn");

  const [at, setAt] = useState<number | null>(null);
  const cur = Math.min(at ?? attempt.current, items.length - 1);
  const curItem = items[cur];
  const curId = curItem.question.id;
  const [draft, setDraft] = useState<{ id: string; r: ExamResponse } | null>(null);
  const response: ExamResponse =
    draft?.id === curId ? draft.r : { choice: curItem.item.choice, typed: curItem.item.typed };
  const [dialog, setDialog] = useState<null | "submit" | "quit" | "help">(null);
  const [away, setAway] = useState<{ warnings: number } | null>(null); // left full screen: the warning shows
  const [fsProblem, setFsProblem] = useState<string | null>(null);
  const ending = useRef(false);

  // Clocks: what was saved before this page load, plus this load's active time.
  const timeOf = useSittingClock(away ? null : curId);
  const base = useRef<Map<string, number> | null>(null);
  if (!base.current) base.current = new Map(items.map((x) => [x.question.id, x.item.time_ms]));
  const timeMs = useCallback((qid: string) => (base.current!.get(qid) ?? 0) + timeOf(qid), [timeOf]);
  const allTimes = useCallback(
    () => Object.fromEntries(items.map((x) => [x.question.id, timeMs(x.question.id)])),
    [items, timeMs],
  );
  const timesRef = useRef(allTimes);
  timesRef.current = allTimes;

  const statuses: ExamStatus[] = items.map((x) => examStatus(x.item));
  const sectionOf = (i: number) => items[i]?.item.section ?? 0;
  const section = sectionOf(cur);
  const inSection = items.map((x, i) => i).filter((i) => sectionOf(i) === section);
  const firstOf = (s: number) => items.findIndex((x) => x.item.section === s);

  /** Opens question `i`: stores the time of the one you leave, marks `i` visited. Saves no answer. */
  const go = (i: number, extra?: { response?: ExamResponse; marked?: boolean }) => {
    if (i < 0 || i >= items.length) return;
    const next = items[i].question.id;
    const leaving = { questionId: curId, timeMs: timeMs(curId), ...extra };
    void save.run({
      attemptId: id,
      current: i,
      items: next === curId ? [{ ...leaving, visited: true }] : [leaving, { questionId: next, visited: true }],
    });
    setAt(i);
    setDraft(null);
  };
  const saveNext = () => go(Math.min(cur + 1, items.length - 1), { response, marked: false });
  const markNext = () => go(Math.min(cur + 1, items.length - 1), { response, marked: true });
  const clear = () => {
    setDraft({ id: curId, r: NO_RESPONSE });
    void save.run({ attemptId: id, items: [{ questionId: curId, response: NO_RESPONSE }] });
  };

  const submit = useCallback(async () => {
    if (ending.current) return;
    ending.current = true;
    await submitM.run({ attemptId: id, times: timesRef.current() });
    exitFullScreen();
    router.replace(reviewHref(id));
  }, [submitM, id, router]);

  const quit = async () => {
    ending.current = true;
    await endM.run({ attemptId: id, status: "abandoned", times: timesRef.current() });
    exitFullScreen();
    router.replace(MOCKS);
  };

  // Leaving the page (not ending the test) keeps the clocks.
  const saveRef = useRef(save.run);
  saveRef.current = save.run;
  useEffect(() => {
    const store = () => {
      if (ending.current) return;
      const t = timesRef.current();
      void saveRef.current({
        attemptId: id,
        items: Object.entries(t).map(([questionId, timeMs]) => ({ questionId, timeMs })),
      });
    };
    const onHide = () => document.visibilityState === "hidden" && store();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      store();
    };
  }, [id]);

  // Full screen: leaving it warns, then fails. Opening the test outside full screen (a refresh) counts as leaving.
  const awayRef = useRef(false);
  const warnRef = useRef(warnM.run);
  warnRef.current = warnM.run;
  const left = useCallback(async () => {
    if (awayRef.current || ending.current) return;
    awayRef.current = true;
    const r = await warnRef.current({ attemptId: id, times: timesRef.current() });
    if (!r) return;
    if (r.failed) {
      ending.current = true;
      exitFullScreen();
      router.replace(reviewHref(id));
    } else setAway({ warnings: r.warnings });
  }, [id, router]);
  useEffect(() => {
    if (!mock.full_screen) return;
    if (!inFullScreen() && !warnedOnLoad.has(id)) {
      warnedOnLoad.add(id);
      void left();
    }
    const onChange = () => {
      if (inFullScreen()) {
        awayRef.current = false;
        setAway(null);
      } else void left();
    };
    const onVisibility = () => document.visibilityState === "hidden" && void left();
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mock.full_screen, id, left]);
  const goBack = async () => {
    setFsProblem(await enterFullScreen());
    if (inFullScreen()) {
      awayRef.current = false;
      setAway(null);
    }
  };

  const sections = attempt.sections;
  const summary = useMemo(
    () =>
      sections.map((s, k) => {
        const c = countStatuses(statuses.filter((_, i) => sectionOf(i) === k));
        return { name: s.name, total: statuses.filter((_, i) => sectionOf(i) === k).length, ...c };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, statuses.join()],
  );

  return (
    <div className="grid gap-4 px-[clamp(14px,2.5vw,32px)] py-4">
      <div className="flex flex-wrap items-center gap-3 border-b border-line pb-3">
        <Heading level={1} className="text-[1.35rem]">
          {mock.name}
        </Heading>
        {mock.full_screen && <Pill tone="red">Full screen</Pill>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ExamTimer endsAt={attempt.started_at + attempt.minutes * 60_000} onTimeUp={submit} />
          <Button variant="ghost" size="sm" onClick={() => setDialog("help")}>
            Instructions
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDialog("quit")}>
            Quit test
          </Button>
        </div>
      </div>

      {sections.length > 1 && (
        <Tabs
          label="Sections"
          shape="bar"
          value={String(section)}
          onChange={(v) => go(firstOf(Number(v)))}
          tabs={sections.map((s, k) => ({ value: String(k), label: s.name }))}
        />
      )}

      <div className="grid items-start gap-5 min-[980px]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-3">
          <ExamQuestion
            key={curId}
            question={curItem.question}
            detail={curItem.detail}
            number={cur + 1}
            response={response}
            onChange={(r) => setDraft({ id: curId, r })}
          />
          <Text variant="hint">Your answer is saved only with **Save & Next** or **Mark for review & Next**.</Text>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="soft" onClick={markNext}>
              Mark for review & Next
            </Button>
            <Button variant="ghost" onClick={clear}>
              Clear response
            </Button>
            <span className="flex-1" />
            <Button variant="soft" icon={<IconChevronLeft />} disabled={cur === 0} onClick={() => go(cur - 1)}>
              Back
            </Button>
            <Button
              variant="soft"
              iconAfter={<IconChevronRight />}
              disabled={cur === items.length - 1}
              onClick={() => go(cur + 1)}
            >
              Next
            </Button>
            <Button variant="primary" onClick={saveNext}>
              Save & Next
            </Button>
          </div>
        </div>

        <Card title={sections[section]?.name ?? "Questions"} className="min-[980px]:sticky min-[980px]:top-4">
          <div className="grid gap-4">
            <QuestionPalette
              states={inSection.map((i) => statuses[i])}
              current={inSection.indexOf(cur)}
              onJump={(k) => go(inSection[k])}
              start={inSection[0] + 1}
              label={`Questions in ${sections[section]?.name ?? "this section"}`}
              counts
            />
            <Button variant="primary" block onClick={() => setDialog("submit")}>
              Submit test
            </Button>
          </div>
        </Card>
      </div>

      <Dialog
        open={dialog === "submit"}
        onClose={() => setDialog(null)}
        title="Submit the test?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              No, go back
            </Button>
            <Button variant="primary" loading={submitM.pending} onClick={submit}>
              Yes, submit
            </Button>
          </>
        }
      >
        <Table
          columns={[
            { key: "s", header: "Section", cell: (r) => r.name },
            { key: "a", header: "Answered", align: "right", cell: (r) => r.answered + r.answered_marked },
            { key: "n", header: "Not answered", align: "right", cell: (r) => r.not_answered + r.marked },
            { key: "m", header: "Marked", align: "right", cell: (r) => r.marked + r.answered_marked },
            { key: "v", header: "Not visited", align: "right", cell: (r) => r.not_visited },
          ]}
          rows={summary}
          rowKey={(r) => r.name}
        />
        <Text>You can't change your answers after submitting.</Text>
      </Dialog>

      <Dialog
        open={dialog === "quit"}
        onClose={() => setDialog(null)}
        title="Quit this test?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Keep going
            </Button>
            <Button variant="danger" loading={endM.pending} onClick={quit}>
              Quit without scoring
            </Button>
          </>
        }
      >
        🔴 **CAUTION:** quitting ends the test for good. It is kept in your history as **abandoned**, it is not scored,
        and none of its answers count in your stats.
      </Dialog>

      <Dialog open={dialog === "help"} onClose={() => setDialog(null)} title="Instructions">
        <Text block>
          {`- Jumping, Back and Next do **not** save the answer; use **Save & Next** or **Mark for review & Next**.
- Answered and marked questions are still marked.
- **Clear response** removes the answer on screen.
- The timer never pauses; at zero the test is submitted for you.`}
        </Text>
      </Dialog>

      <Dialog
        open={!!away}
        shake
        onClose={goBack}
        title="You left full screen"
        footer={
          <Button variant="primary" onClick={goBack}>
            Return to full screen
          </Button>
        }
      >
        {`🔴 **CAUTION:** this is warning ${away?.warnings ?? 1} of ${ALLOWED_WARNINGS}. **If you leave full screen again, the test ends at once and is marked failed.** A failed test is not scored and its answers don't count.`}
        <Text variant="small">The timer is still running. Go back to full screen to carry on.</Text>
        {fsProblem && <Text variant="error">{fsProblem}</Text>}
      </Dialog>
    </div>
  );
}
