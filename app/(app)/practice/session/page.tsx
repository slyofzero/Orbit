"use client";
// /practice/session?topic=<id>: answering a topic's questions one at a time (components/practice/PracticeSession.tsx).
// The topic is in the address, so the page stays static.

import { Suspense } from "react";
import { Page } from "@/components/app/Page";
import { PracticeSessionScreen } from "@/components/practice/PracticeSession";

/** useSearchParams (the topic) needs a Suspense boundary. */
export default function PracticeSessionPage() {
  return (
    <Page>
      <Suspense fallback={null}>
        <PracticeSessionScreen />
      </Suspense>
    </Page>
  );
}
