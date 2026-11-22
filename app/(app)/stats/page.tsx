"use client";
// /stats: v1's Stats, kept simple. Three tabs in the address (?tab=overview | topics | questions): Overview
// (totals, the last 14 days, strongest / weakest topics, subjects), Subjects & topics (tables of right / wrong /
// time / strength) and Questions (each question you were shown: times right and wrong, time spent, the mistake
// log). "Clear stats" (top right) deletes every answer after a typed confirmation (`stats.clear`).
// Data: `stats.summary` and `stats.questions` (lib/db/queries/stats.ts); rules: lib/stats.ts, docs/STATS.md.

import { Suspense, useMemo, useState } from "react";
import { Page } from "@/components/app/Page";
import { StatsOverview } from "@/components/stats/StatsOverview";
import { StatsQuestions } from "@/components/stats/StatsQuestions";
import { StatsTopics } from "@/components/stats/StatsTopics";
import { ConfirmPhraseDialog } from "@/components/manage/ConfirmPhraseDialog";
import { IconTrash } from "@/components/icons";
import { Button, EmptyState, Heading, Tabs, useToast } from "@/components/ui";
import { useTab } from "@/components/utils/useTab";
import { useMutation, useQuery } from "@/lib/db/client";
import { todayIST } from "@/lib/dates";
import type { QuestionShow } from "@/lib/stats";

const TABS = ["overview", "topics", "questions"] as const;

/** useSearchParams (the tab) needs a Suspense boundary. */
export default function StatsPage() {
  return (
    <Suspense fallback={null}>
      <Stats />
    </Suspense>
  );
}

function Stats() {
  const [tab, setTab] = useTab(TABS, "overview");
  const today = useMemo(() => todayIST(), []);
  const { data } = useQuery("stats.summary", { today });
  const [subject, setSubject] = useState(""); // "" = every subject; shared by the two tabs that filter by it
  const [show, setShow] = useState<QuestionShow>("all"); // the Overview's "Open the mistake log" sets it
  const [clearing, setClearing] = useState(false); // the "Clear stats" dialog is open
  const clear = useMutation("stats.clear");
  const toast = useToast();
  if (!data) return null;
  const empty = data.totals.shown === 0;
  const clearIt = async () => {
    const r = await clear.run();
    if (!r) return false; // the hook already showed the error
    setTab("overview");
    toast(
      `Stats cleared: ${r.answers} answer${r.answers === 1 ? "" : "s"} and ${r.attempts} mock attempt${r.attempts === 1 ? "" : "s"} deleted.`,
      "success",
    );
    return true;
  };

  return (
    <Page>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Heading level={1}>Stats</Heading>
        {!empty && (
          <Tabs
            shape="bar"
            label="Stats sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "overview", label: "Overview" },
              { value: "topics", label: "Subjects & topics" },
              {
                value: "questions",
                label: "Questions",
                ...(data.totals.mistakes ? { count: data.totals.mistakes } : {}),
              },
            ]}
          />
        )}
        <Button
          variant="danger"
          className="ml-auto"
          icon={<IconTrash />}
          disabled={empty}
          onClick={() => setClearing(true)}
        >
          Clear stats
        </Button>
      </div>

      <ConfirmPhraseDialog
        open={clearing}
        onClose={() => setClearing(false)}
        title="Clear all stats?"
        phrase="clear stats"
        warning={`It deletes **every answer** you have given (${data.totals.shown}, practice and mocks) with its time, and **every finished mock attempt** with its score. 🔴 Questions on your plan that were ticked by answering them get **unticked**, so past days can show as not done. Your questions, mocks, plan tasks and topic ratings stay. Export a backup first if you might want them back.`}
        keepLabel="Keep my stats"
        confirmLabel="Clear stats"
        pending={clear.pending}
        onConfirm={clearIt}
      />

      {empty ? (
        <div className="mt-5">
          <EmptyState icon="📊" title="No answers yet" action={<Button href="/practice">Go to Practice</Button>}>
            Practise a topic or take a mock. Every answer, and the time you spend on each question, shows up here.
          </EmptyState>
        </div>
      ) : (
        // keyed by the tab, so switching tabs mounts the new content and it pops in again
        <div key={tab} className="mt-5 animate-card-in">
          {tab === "overview" ? (
            <StatsOverview
              data={data}
              onSubject={(id) => {
                setSubject(id);
                setTab("topics");
              }}
              onMistakes={() => {
                setShow("mistakes");
                setTab("questions");
              }}
            />
          ) : tab === "topics" ? (
            <StatsTopics data={data} subject={subject} onSubject={setSubject} />
          ) : (
            <StatsQuestions data={data} subject={subject} onSubject={setSubject} show={show} onShow={setShow} />
          )}
        </div>
      )}
    </Page>
  );
}
