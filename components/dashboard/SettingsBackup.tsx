"use client";
// v1's "Settings and backup" at the bottom of the dashboard. Nothing here is wired yet (useSoon):
// the name, milestone reset, start fresh and export / import come in the functionality step.

import { useState } from "react";
import { Button, Callout, Disclosure, Text, TextField } from "@/components/ui";
import { useSoon } from "@/components/dashboard/kit";

export function SettingsBackup() {
  const soon = useSoon();
  const [name, setName] = useState("");
  const [wipe, setWipe] = useState(false);
  return (
    <Disclosure title="Settings and backup" className="mt-[22px]">
      <div className="flex flex-wrap items-end gap-2.5">
        <TextField
          label="Your name"
          placeholder="Optional"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={soon("Saving your name")}
        />
        <Button variant="soft" onClick={soon("Resetting milestones")}>
          Reset milestones to the plan&apos;s own
        </Button>
        <Button variant="soft" href="/planner/upload">
          Change plan
        </Button>
        {!wipe ? (
          <Button variant="soft" onClick={() => setWipe(true)}>
            Start fresh
          </Button>
        ) : (
          <>
            <Text as="span" variant="small">
              Deletes your plan, pack, ticks, practice, mocks and milestones.
            </Text>
            <Button variant="danger" onClick={soon("Start fresh")}>
              Yes, delete everything
            </Button>
            <Button variant="soft" onClick={() => setWipe(false)}>
              Cancel
            </Button>
          </>
        )}
        <Button variant="soft" onClick={soon("Exporting progress")}>
          Export progress
        </Button>
        <Button variant="soft" onClick={soon("Importing progress")}>
          Import progress
        </Button>
      </div>
      <Callout tone="caution">
        CAUTION: Your progress lives in this browser only. Do NOT clear site data without exporting first.
      </Callout>
    </Disclosure>
  );
}
