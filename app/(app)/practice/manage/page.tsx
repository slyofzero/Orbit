"use client";
// /practice/manage?tab=questions|mock-tests|topics|plan|upload: v1's Manage pack (components/manage/ManagePack.tsx).
// The section is in the address (useTab), so Back goes to the previous one.

import { Suspense } from "react";
import { Page } from "@/components/app/Page";
import { ManagePack } from "@/components/manage/ManagePack";

/** useSearchParams (the tab) needs a Suspense boundary. */
export default function ManagePage() {
  return (
    <Page>
      <Suspense fallback={null}>
        <ManagePack />
      </Suspense>
    </Page>
  );
}
