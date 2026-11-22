"use client";
// v1's "Settings and backup" at the bottom of the dashboard: your name (the greeting uses it; saved when you leave
// the box, settings.set), Reset milestones to the plan file's own (with Undo), Start fresh (deletes everything,
// clears the site's browser data and goes back to /onboarding), Export progress and Import progress (lib/backup.ts;
// importing replaces everything, so it opens a dialog with the file's preview and a CAUTION before anything is
// restored).

import { useEffect, useState } from "react";
import { Button, Callout, Dialog, Disclosure, Text, TextField, useToast } from "@/components/ui";
import { RestoreBackup } from "@/components/dashboard/RestoreBackup";
import { dbCall, useMutation, useQuery } from "@/lib/db/client";
import { todayIST } from "@/lib/dates";
import { downloadText } from "@/lib/download";
import { NAME_MAX } from "@/lib/settings";
import { clearBrowserData } from "@/lib/siteData";

export function SettingsBackup() {
  const toast = useToast();
  const saved = useQuery("settings.all").data?.name;
  const [name, setName] = useState("");
  const [wipe, setWipe] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fresh = useMutation("app.startFresh");
  const { run: setSetting } = useMutation("settings.set");
  const reset = useMutation("milestone.reset");
  const { run: restoreAll } = useMutation("milestone.restoreAll");

  // the box follows the saved name (first load, or a change in another tab)
  useEffect(() => {
    if (saved !== undefined) setName(saved);
  }, [saved]);

  const saveName = async () => {
    if (saved === undefined || name.trim() === saved) return;
    const r = await setSetting({ key: "name", value: name });
    if (!r) return; // the hook already showed the error
    if (!r.ok) return toast(r.error, "error");
    toast(r.value ? `Hello, **${r.value}**! The greeting uses your name now.` : "Name removed.", "success");
  };

  const resetMilestones = async () => {
    const r = await reset.run();
    if (!r) return;
    if (!r.ok) return toast(r.errors.join(" "), "error");
    toast(`Milestones are back to the plan's own (**${r.count}**).`, "success", {
      label: "Undo",
      onClick: async () => {
        const u = await restoreAll({ rows: r.before });
        if (u && !u.ok) toast(`Couldn't undo: ${u.errors.join(" ")}`, "error");
      },
    });
  };

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
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void saveName()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <Button variant="soft" loading={reset.pending} onClick={resetMilestones}>
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
        <Button variant="soft" onClick={() => setImporting(true)}>
          Import progress
        </Button>
      </div>
      <Callout tone="caution">
        CAUTION: Your progress lives in this browser only. Do NOT clear site data without exporting first.
      </Callout>
      <Dialog open={importing} onClose={() => setImporting(false)} title="Import progress">
        <div className="grid gap-3">
          <Text variant="muted" block>
            Drop a backup saved with **Export progress**. You see what is in it before anything changes.
          </Text>
          <Callout tone="caution">
            CAUTION: Importing REPLACES everything in this browser (plan, questions, answers, mocks, ticks, milestones).
            Export progress first if you may want today's data back.
          </Callout>
          <Button variant="soft" loading={exporting} onClick={exportProgress} className="justify-self-start">
            Export progress first
          </Button>
          <RestoreBackup bare onDone={() => setImporting(false)} />
        </div>
      </Dialog>
    </Disclosure>
  );
}
