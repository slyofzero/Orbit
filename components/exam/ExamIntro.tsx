"use client";
// The instructions page before a mock starts (/exam?mock=<id>): what the test holds, how the screen works, the
// full-screen rule, and "I'm ready". Starting creates the attempt (`mock.start`) and opens /exam?attempt=<id>.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Callout,
  Card,
  Checkbox,
  EmptyState,
  Heading,
  Pill,
  Rich,
  StatTile,
  Table,
  Text,
} from "@/components/ui";
import { QuestionPalette } from "@/components/question";
import { enterFullScreen, exitFullScreen } from "@/components/exam/fullScreen";
import { useMutation, useQuery } from "@/lib/db/client";
import { ALLOWED_WARNINGS, EXAM_STATUSES, type MockIntro } from "@/lib/exam";

export const MOCKS = "/practice?tab=mocks";
const num = (n: number) => String(Math.round(n * 100) / 100);

const HOW = `1. The timer at the top counts down. It never pauses, not even if you leave the page. When it reaches zero the test is submitted for you.
2. Click a number in the palette to jump to that question. **Jumping, Back and Next do not save your answer.**
3. **Save & Next** saves the answer and moves on. **Mark for review & Next** saves it (if any) and flags the question so you can come back. Answered and marked questions are still marked.
4. **Clear response** removes the answer to the question on screen.
5. Each question shows its marks and any negative marking. A multiple-select answer scores only when every option picked is right.
6. You can move between sections and change saved answers until you submit.`;

const SECTIONS = [
  { key: "name", header: "Section", cell: (s: MockIntro["sections"][number]) => s.name },
  { key: "qs", header: "Questions", align: "right" as const, cell: (s: MockIntro["sections"][number]) => s.questions },
  { key: "marks", header: "Marks", align: "right" as const, cell: (s: MockIntro["sections"][number]) => num(s.marks) },
];

export function ExamIntro({ mockId }: { mockId: string }) {
  const router = useRouter();
  const { data } = useQuery("mock.intro", { mockId });
  const start = useMutation("mock.start");
  const [agree, setAgree] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!data) return null;
  if (!data.mock)
    return (
      <EmptyState icon="🔎" title="That mock isn't here" action={<Button href={MOCKS}>Back to Mocks</Button>}>
        It may have been removed. Pick another one on the Mocks tab.
      </EmptyState>
    );
  const mock = data.mock;

  const begin = async () => {
    setProblem(null);
    if (mock.full_screen) {
      const err = await enterFullScreen();
      if (err) return setProblem(err);
    }
    const id = await start.run({ mockId: mock.id });
    if (!id) return exitFullScreen();
    router.replace(`/exam?attempt=${encodeURIComponent(id)}`);
  };

  return (
    <div className="mx-auto grid max-w-[820px] gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Heading level={1}>{mock.name}</Heading>
        {mock.full_screen && <Pill tone="red">Full screen</Pill>}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
        <StatTile value={data.questions} label="questions" tone="accent" />
        <StatTile value={num(data.marks)} label="marks" tone="green" />
        <StatTile value={mock.minutes} label="minutes" tone="amber" />
      </div>

      {data.open && (
        <Callout tone="warn" title="Another test is in progress">
          {`**${data.open.name}** hasn't been finished. Finish it or end it before starting a new one.`}
          <div className="mt-2.5">
            <Button variant="primary" href={`/exam?attempt=${encodeURIComponent(data.open.id)}`}>
              Go to that test
            </Button>
          </div>
        </Callout>
      )}

      {mock.instructions && (
        <Card title="About this test">
          <Rich text={mock.instructions} block />
        </Card>
      )}

      {data.sections.length > 1 && (
        <Table columns={SECTIONS} rows={data.sections} rowKey={(s) => s.name} caption="Sections" />
      )}

      <Card title="How the test works">
        <div className="grid gap-4">
          <Text block>{HOW}</Text>
          <div className="grid gap-2">
            <Text variant="caption">The palette shows where you are with each question</Text>
            <QuestionPalette states={[...EXAM_STATUSES]} current={-1} onJump={() => {}} label="Palette colours" />
          </div>
          {data.code > 0 && (
            <Text variant="small">
              {`${data.code} code question${data.code === 1 ? " is" : "s are"} in this test. Code can't be marked automatically, so ${data.code === 1 ? "it is" : "they are"} left out of the score; you'll see your code in the review.`}
            </Text>
          )}
        </div>
      </Card>

      {mock.full_screen && (
        <Callout tone="caution" title="CAUTION: this test runs in full screen">
          {`Do NOT press Esc, switch tabs or windows, or refresh. Leaving full screen ${ALLOWED_WARNINGS === 1 ? "once" : `${ALLOWED_WARNINGS} times`} gives you a warning; leaving it again **ends the test as failed**, and it is not scored. The timer never pauses.`}
        </Callout>
      )}
      {problem && (
        <Callout tone="warn" title="Couldn't start">
          {problem}
        </Callout>
      )}

      <Checkbox checked={agree} onChange={setAgree} label="I have read the instructions." />
      <div className="flex flex-wrap gap-2.5">
        <Button variant="primary" disabled={!agree || !!data.open} loading={start.pending} onClick={begin}>
          {mock.full_screen ? "I'm ready: start in full screen" : "I'm ready: start"}
        </Button>
        <Button variant="ghost" href={MOCKS}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
