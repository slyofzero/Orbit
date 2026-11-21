"use client";
// /practice/code?id=<question id>: one programming question beside the editor (components/practice/CodeSession.tsx).
// The question is in the address, so the page stays static.

import { Suspense } from "react";
import { Page } from "@/components/app/Page";
import { CodeSessionScreen } from "@/components/practice/CodeSession";

/** useSearchParams (the question) needs a Suspense boundary. */
export default function CodeQuestionPage() {
  return (
    <Page>
      <Suspense fallback={null}>
        <CodeSessionScreen />
      </Suspense>
    </Page>
  );
}
