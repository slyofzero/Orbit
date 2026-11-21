"use client";
// /practice/review?attempt=<id>: the review of a mock attempt (components/exam/AttemptReview.tsx).
// The attempt is in the address, so the page stays static.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Page } from "@/components/app/Page";
import { Button, EmptyState } from "@/components/ui";
import { AttemptReview } from "@/components/exam/AttemptReview";
import { MOCKS } from "@/components/exam/ExamIntro";

function Review() {
  const attempt = useSearchParams().get("attempt");
  if (!attempt)
    return (
      <EmptyState icon="🧭" title="No attempt chosen" action={<Button href={MOCKS}>Back to Mocks</Button>}>
        Pick one in the history on the Mocks tab.
      </EmptyState>
    );
  return <AttemptReview key={attempt} attemptId={attempt} />;
}

/** useSearchParams needs a Suspense boundary. */
export default function ReviewPage() {
  return (
    <Page>
      <Suspense fallback={null}>
        <Review />
      </Suspense>
    </Page>
  );
}
