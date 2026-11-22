"use client";
// The "Already use Orbit?" card at the bottom of /onboarding: drop the backup saved by "Export progress"
// (lib/backup.ts) and everything comes back: plan, questions, answers, mocks, ticks. The file is checked as
// soon as it lands and previewed; restoring REPLACES whatever is in this browser (`backup.import`). Once a
// plan is back, the app frame moves on to /dashboard by itself.
// `bare` = only the drop zone, preview and Restore button, for the dashboard's Import progress dialog;
// `onDone` runs after a successful restore.

import { useEffect, useState, type ReactNode } from "react";
import { Button, Callout, FileInput, Heading, ImportProblems, Pill, Stat, Text, useToast } from "@/components/ui";
import { useMutation } from "@/lib/db/client";
import { formatLong, todayIST } from "@/lib/dates";
import { parseBackup, type BackupParse } from "@/lib/backup";

export function RestoreBackup({ bare = false, onDone }: { bare?: boolean; onDone?: () => void } = {}) {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [check, setCheck] = useState<BackupParse | null>(null);
  const [refused, setRefused] = useState<string[]>([]); // what the restore itself refused
  const restore = useMutation("backup.import");

  // check the file as soon as it lands
  useEffect(() => {
    const f = files[0];
    setRefused([]);
    if (!f) return setCheck(null);
    let live = true;
    f.text().then((t) => {
      if (!live) return;
      setText(t);
      setCheck(parseBackup(t));
    });
    return () => {
      live = false;
    };
  }, [files]);

  const sum = check?.summary ?? null;
  const errors = [...(check && !check.backup ? check.errors : []), ...refused];

  const go = async () => {
    const r = await restore.run({ text });
    if (!r) return; // the hook already showed the error
    if (!r.ok) return setRefused(r.errors);
    setFiles([]);
    toast(
      r.plan
        ? `Welcome back! **${r.plan}** is restored: ${r.questions} questions, ${r.answers} answers.`
        : `Restored ${r.questions} questions and ${r.answers} answers. The backup had no plan, so add one above.`,
      "special",
    );
    onDone?.();
    // with a plan back, the app frame moves on to /dashboard by itself
  };

  const body: ReactNode = (
    <>
      <FileInput
        accept=".json,application/json"
        files={files}
        onChange={setFiles}
        title="Drop your backup file here"
        description="Any .json backup · checked the moment it lands"
        buttonLabel="Choose the backup"
      />

      {errors.length > 0 && <ImportProblems kind="backup" errors={errors} />}

      {check?.backup && sum && (
        <div className="grid gap-4 rounded-[18px] border border-line bg-sheet-2/70 p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {sum.plan && <Pill tone="accent">{sum.plan}</Pill>}
            <Text variant="muted" as="span">{`Saved on ${formatLong(todayIST(sum.exportedAt))}`}</Text>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4">
            <Stat value={sum.days} label="plan days" />
            <Stat value={sum.questions} label="questions" />
            <Stat value={sum.answers} label="answers" />
            <Stat value={sum.attempts} label="mock attempts" />
          </div>
          <Callout tone="caution">
            CAUTION: Restoring replaces everything that is in this browser right now with the backup.
          </Callout>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="primary" loading={restore.pending} onClick={go}>
              Restore this backup
            </Button>
            <Button variant="ghost" onClick={() => setFiles([])}>
              Pick another file
            </Button>
          </div>
        </div>
      )}
    </>
  );

  if (bare) return <div className="grid gap-3">{body}</div>;
  return (
    <section
      className="grid animate-card-in gap-3 rounded-[22px] border border-dashed border-line bg-sheet/70 p-5 backdrop-blur-sm"
      style={{ animationDelay: "480ms", animationFillMode: "both" }}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-2xl" aria-hidden="true">
          🛟
        </span>
        <Heading level={3}>Already use Orbit? Restore your progress</Heading>
        <Pill tone="neutral">or</Pill>
      </div>
      <Text variant="muted" block>
        Drop the backup file you saved with **Export progress**. Your plan, questions, answers, mocks and ticks come
        back exactly as they were, so you can skip the steps above.
      </Text>
      {body}
    </section>
  );
}
