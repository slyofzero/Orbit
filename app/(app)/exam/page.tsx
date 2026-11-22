"use client";
// /exam?mock=<id>: a mock's instructions page (components/exam/ExamIntro.tsx).
// /exam?attempt=<id>: the exam screen of a test in progress (components/exam/ExamScreen.tsx).
// AppFrame leaves the rail out here, so the test fills the screen. Both ids are in the address: the page is static.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Page } from "@/components/app/Page";
import { Button, EmptyState } from "@/components/ui";
import { ExamIntro, MOCKS } from "@/components/exam/ExamIntro";
import { ExamScreen } from "@/components/exam/ExamScreen";

function Exam() {
  const q = useSearchParams();
  const attempt = q.get("attempt");
  const mock = q.get("mock");
  if (attempt) return <ExamScreen key={attempt} attemptId={attempt} />;
  return (
    <Page>
      {mock ? (
        <ExamIntro key={mock} mockId={mock} />
      ) : (
        <EmptyState icon="🧭" title="No test chosen" action={<Button href={MOCKS}>Back to Mocks</Button>}>
          Pick a test on the Mocks tab to start.
        </EmptyState>
      )}
    </Page>
  );
}

/** useSearchParams needs a Suspense boundary. */
export default function ExamPage() {
  return (
    <Suspense fallback={null}>
      <Exam />
    </Suspense>
  );
}
