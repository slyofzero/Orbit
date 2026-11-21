"use client";
// v1's "Settings and backup" at the bottom of the dashboard. Working: Start fresh (deletes everything,
// clears the site's browser data and goes back to /onboarding) and Export progress (lib/backup.ts).
// Not wired yet (useSoon): the name, milestone reset and Import progress (restoring a backup is on
// /onboarding for now).

import { useState } from "react";
import { Button, Callout, Disclosure, Text, TextField, useToast } from "@/components/ui";
import { useSoon } from "@/components/dashboard/kit";
import { dbCall, useMutation } from "@/lib/db/client";
import { todayIST } from "@/lib/dates";
import { downloadText } from "@/lib/download";
import { clearBrowserData } from "@/lib/siteData";

export function SettingsBackup() {
  const soon = useSoon();
  const toast = useToast();
  const [name, setName] = useState("");
  const [wipe, setWipe] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fresh = useMutation("app.startFresh");

  const exportProgress = async () => {
    setExporting(true);
    try {
      const r = await dbCall("backup.export");
      downloadText(`orbit-backup-${todayIST()}.json`, r.text);
      toast(
        `Saved a backup: **${r.questions}** questions and **${r.answers}** answers. Keep the file safe.`,
        "success",
      );
    } catch (e) {
      toast(`Couldn't export: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setExporting(false);
    }
  };

  // 🔴 deletes everything, then clears the browser's data for this site and starts over at /onboarding
  const startFresh = async () => {
    if (!(await fresh.run())) return; // the hook already showed the error
    await clearBrowserData();
    window.location.assign("/onboarding");
  };
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
              Deletes your plan, questions, ticks, practice, mocks and milestones, and clears this site's saved data and
              settings. It can't be undone: export first if you may want it back.
            </Text>
            <Button variant="danger" loading={fresh.pending} onClick={startFresh}>
              Yes, delete everything
            </Button>
            <Button variant="soft" disabled={fresh.pending} onClick={() => setWipe(false)}>
              Cancel
            </Button>
          </>
        )}
        <Button variant="soft" loading={exporting} onClick={exportProgress}>
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
