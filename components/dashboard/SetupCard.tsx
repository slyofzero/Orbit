"use client";
// The dashboard's setup guide (v1's "Set up your study space", now a guide): shown until both a plan and a
// question pack are loaded. Both are optional (someone may only want to practise, or only follow a plan), so
// each is a step the user can take when they want; a loaded one shows as done.

import type { ReactNode } from "react";
import { IconArrowRight, IconCheck } from "@/components/icons";
import { Button, Card, Heading, Pill, Text } from "@/components/ui";
import { cx } from "@/components/utils/cx";
import { useQuery } from "@/lib/db/client";

function GuideStep({
  n,
  done,
  title,
  children,
  action,
}: {
  n: number;
  done: boolean;
  title: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-[18px] border border-line bg-sheet/60 p-4 glass-blur">
      <span
        className={cx(
          "grid size-9 place-items-center rounded-full font-display font-extrabold",
          done ? "bg-green-soft text-green" : "special-fill animate-flow",
        )}
      >
        {done ? <IconCheck className="h-4 w-4" /> : n}
      </span>
      <div className="grid min-w-0 content-start gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Heading level={3}>{title}</Heading>
          {done ? <Pill tone="green">Done</Pill> : <Pill tone="neutral">Optional</Pill>}
        </div>
        <Text variant="muted">{children}</Text>
        {!done && <div className="mt-1">{action}</div>}
      </div>
    </li>
  );
}

export function SetupCard() {
  const { data } = useQuery("setup.status");
  if (!data || (data.hasPlan && data.hasQuestions)) return null;
  return (
    <Card
      className="mb-[22px] border-accent!"
      title="Set up your study space"
      subtitle="Orbit works with either, or both. Add them whenever you like; you can skip this and come back."
    >
      <ol className="grid gap-3 min-[980px]:grid-cols-2">
        <GuideStep
          n={1}
          done={data.hasPlan}
          title="Load a study plan"
          action={
            <Button variant="primary" href="/onboarding" icon={<IconArrowRight className="h-4 w-4" />}>
              Load a plan
            </Button>
          }
        >
          A day-by-day plan fills the calendar, the agenda and the Planner, with tasks to tick, a countdown and a
          streak.
        </GuideStep>
        <GuideStep
          n={2}
          done={data.hasQuestions}
          title="Load a question pack"
          action={
            <Button variant="primary" href="/practice" icon={<IconArrowRight className="h-4 w-4" />}>
              Load a question pack
            </Button>
          }
        >
          Questions power topic practice, programming, mock tests and your stats. This is all you need to just practise.
        </GuideStep>
      </ol>
    </Card>
  );
}
