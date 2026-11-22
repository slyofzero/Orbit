"use client";
// v1's "Set up your study space": shown until both a plan and a question pack are loaded.

import { Button, Card } from "@/components/ui";
import { useQuery } from "@/lib/db/client";

export function SetupCard() {
  const { data } = useQuery("setup.status");
  if (!data || (data.hasPlan && data.hasQuestions)) return null;
  return (
    <Card
      className="mb-[22px] border-accent! [&>header]:mb-0"
      title="Set up your study space"
      subtitle="Nothing is loaded yet, so the calendar, planner, practice and mocks are empty. Upload a plan for your daily targets and a question pack for practice and mock tests."
      actions={
        <div className="flex flex-wrap gap-2.5">
          {!data.hasPlan && (
            <Button variant="primary" href="/onboarding">
              Load a plan
            </Button>
          )}
          {!data.hasQuestions && (
            <Button variant="primary" href="/practice">
              Load a question pack
            </Button>
          )}
        </div>
      }
    />
  );
}
