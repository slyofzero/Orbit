"use client";
// /stats/question?id=<question id>: one question's history (components/stats/QuestionHistory.tsx).

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Page } from "@/components/app/Page";
import { QuestionHistory } from "@/components/stats/QuestionHistory";

/** useSearchParams (the id) needs a Suspense boundary. */
export default function QuestionHistoryPage() {
  return (
    <Suspense fallback={null}>
      <History />
    </Suspense>
  );
}

function History() {
  const id = useSearchParams().get("id");
  return (
    <Page>
      {/* keyed by the id, so moving to another question starts fresh */}
      <QuestionHistory key={id ?? ""} questionId={id} />
    </Page>
  );
}
