"use client";
// /practice: v1's Practice. Three sections kept in the address (?tab=topics | programming | mocks): Topics
// (subjects and topics to practise), Programming (code questions) and Mocks (full-length and quick tests).
// A section with nothing loaded shows how to load some instead (PracticeOnboarding). "Manage pack" / "Manage
// mocks" open /practice/manage (components/manage/ManagePack.tsx).

import { Suspense, useState } from "react";
import { Page } from "@/components/app/Page";
import { ImportCelebration, type Celebration } from "@/components/practice/ImportCelebration";
import { MocksTab } from "@/components/practice/MocksTab";
import { PracticeOnboarding } from "@/components/practice/PracticeOnboarding";
import { ProgrammingTab } from "@/components/practice/ProgrammingTab";
import { TopicsTab } from "@/components/practice/TopicsTab";
import { Button, Heading, Tabs } from "@/components/ui";
import { useTab } from "@/components/utils/useTab";
import { useQuery } from "@/lib/db/client";
import { PRACTICE_TABS, tabEmpty } from "@/lib/practice";

/** useSearchParams (the tab) needs a Suspense boundary. */
export default function PracticePage() {
  return (
    <Suspense fallback={null}>
      <Practice />
    </Suspense>
  );
}

function Practice() {
  const [tab, setTab] = useTab(PRACTICE_TABS, "topics");
  const { data: counts } = useQuery("practice.counts");
  const [loaded, setLoaded] = useState<Celebration | null>(null); // what was just imported: plays the transition
  if (!counts) return null;
  const empty = tabEmpty(tab, counts);

  return (
    <Page>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Heading level={1}>Practice</Heading>
        <Tabs
          shape="bar"
          label="Practice sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "topics", label: "Topics" },
            {
              value: "programming",
              label: "Programming",
              ...(counts.programming ? { count: counts.programming } : {}),
            },
            { value: "mocks", label: "Mocks" },
          ]}
        />
        {!empty && (
          <Button
            variant="secondary"
            className="ml-auto"
            href={tab === "mocks" ? "/practice/manage?tab=mock-tests" : "/practice/manage"}
          >
            {tab === "mocks" ? "Manage mocks" : "Manage pack"}
          </Button>
        )}
      </div>

      {/* keyed by the tab, so switching tabs mounts the new content and it pops in again */}
      <div key={tab} className="mt-5 animate-card-in">
        {empty ? (
          <PracticeOnboarding kind={tab} onLoaded={setLoaded} />
        ) : tab === "topics" ? (
          <TopicsTab />
        ) : tab === "programming" ? (
          <ProgrammingTab />
        ) : (
          <MocksTab />
        )}
      </div>

      {/* plays over the page while the freshly loaded tab fills in underneath */}
      {loaded && <ImportCelebration summary={loaded} onDone={() => setLoaded(null)} />}
    </Page>
  );
}
