"use client";
// /practice/day?date=<YYYY-MM-DD>: a sitting of one plan day's linked questions (components/practice/PracticeSession.tsx).
// The day is in the address, so the page stays static.

import { Suspense } from "react";
import { Page } from "@/components/app/Page";
import { DayPracticeScreen } from "@/components/practice/PracticeSession";

/** useSearchParams (the date) needs a Suspense boundary. */
export default function DayPracticePage() {
  return (
    <Page>
      <Suspense fallback={null}>
        <DayPracticeScreen />
      </Suspense>
    </Page>
  );
}
