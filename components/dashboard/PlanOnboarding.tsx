"use client";
// What the dashboard shows until there is a plan: the "welcome" backdrop scene and three steps to launch
// one (ask an AI → save the file → drop it here). The file is checked as soon as it lands (lib/planFile.ts),
// previewed, and imported in one go (plan.import). The AI prompt is lib/prompts/planPrompt.ts.
// A tab switches the steps for "Import progress": someone coming back restores a backup instead (RestoreBackup).

import { useEffect, useState, type ReactNode } from "react";
import {
  Button,
  Callout,
  CopyButton,
  Dialog,
  FileInput,
  Heading,
  ImportProblems,
  Pill,
  Stat,
  Tabs,
  Text,
  useToast,
} from "@/components/ui";
import { RestoreBackup } from "@/components/dashboard/RestoreBackup";
import { LAUNCH_MS } from "@/components/background/LaunchWarp";
import { useScene } from "@/components/background/Backdrop";
import { cx } from "@/components/utils";
import { useMutation } from "@/lib/db/client";
import { formatLong, todayIST, type IsoDate } from "@/lib/dates";
import { parsePlanFile, planSummary, type PlanParse } from "@/lib/planFile";
import { planPrompt } from "@/lib/prompts/planPrompt";

/** One numbered step. `bare` drops the card (border, background, padding), e.g. inside a dialog. */
export function Step({
  n,
  title,
  children,
  delay,
  bare = false,
}: {
  n: number;
  title: string;
  children: ReactNode;
  delay: number;
  bare?: boolean;
}) {
  return (
    <li
      className={cx(
        "grid animate-card-in grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2",
        !bare && "rounded-[22px] border border-line bg-sheet/80 p-5 glass-blur",
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <span className="special-fill animate-flow grid size-10 place-items-center rounded-full font-display text-lg font-extrabold">
        {n}
      </span>
      <div className="grid min-w-0 content-start gap-2">
        <Heading level={3}>{title}</Heading>
        {children}
      </div>
    </li>
  );
}

/** `onLaunched` runs once a plan is imported (the page plays the launch sequence). */
export function PlanOnboarding({ onLaunched }: { onLaunched?: (name: string) => void }) {
  useScene("welcome");
  const toast = useToast();
  const [today, setToday] = useState<IsoDate | null>(null);
  useEffect(() => setToday(todayIST()), []);
  const [mode, setMode] = useState<"plan" | "progress">("plan");
  const [peek, setPeek] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [check, setCheck] = useState<PlanParse | null>(null);
  const launch = useMutation("plan.import");
  const sample = useMutation("dev.samplePlan");

  // check the file as soon as it lands
  useEffect(() => {
    const f = files[0];
    if (!f) return setCheck(null);
    let live = true;
    f.text().then((t) => {
      if (!live) return;
      setText(t);
      setCheck(parsePlanFile(t));
    });
    return () => {
      live = false;
    };
  }, [files]);

  const plan = check?.plan ?? null;
  const sum = plan ? planSummary(plan) : null;

  const go = async () => {
    const r = await launch.run({ text });
    if (!r) return; // the hook already showed the error
    if (!r.ok) return setCheck({ plan: null, errors: r.errors, warnings: r.warnings });
    onLaunched?.(r.name);
    // after the launch sequence has landed (components/background/LaunchWarp.tsx)
    setTimeout(
      () => toast(`**${r.name}** is launched: ${r.days} days, ${r.tasks} tasks. Have a good first day!`, "special"),
      LAUNCH_MS,
    );
    // the app frame moves on to /dashboard by itself (it re-reads the plans table)
  };

  return (
    <section className="min-h-screen max-[760px]:min-h-0">
      <div className="grid max-w-[820px] gap-7 p-[clamp(22px,4vw,56px)]">
        <div className="grid animate-card-in justify-items-start gap-4">
          <Pill tone="accent">🪐 Welcome to Orbit</Pill>
          <Heading level={1} className="text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.03em]">
            Every orbit starts with a <span className="special-text animate-flow">plan</span>.
          </Heading>
          <Text className="max-w-[60ch] text-[1.08rem] text-ink-2">
            Orbit turns your plan into a day-by-day countdown: tasks to tick, questions to practise and a streak to keep
            alive. You don&apos;t have one yet, so let&apos;s launch it. It takes about five minutes.
          </Text>
        </div>

        <Tabs
          label="How to start"
          value={mode}
          onChange={setMode}
          tabs={[
            { value: "plan", label: "New plan" },
            { value: "progress", label: "Import progress" },
          ]}
        />

        {mode === "progress" && <RestoreBackup />}

        {mode === "plan" && (
          <>
            <ol className="m-0 grid list-none gap-3.5 p-0">
              <Step n={1} title="Ask an AI to draft it" delay={120}>
                <Text variant="muted">
                  Copy this prompt into any AI chat. It asks about your goal, your dates and your free time, then writes
                  the whole plan for you.
                </Text>

                <div className="flex gap-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <CopyButton
                      variant="primary"
                      text={() => planPrompt(today ?? todayIST())}
                      label="Copy the AI prompt"
                      copiedLabel="Copied. Paste it into your AI chat"
                    />
                  </div>
                  <Button variant="soft" onClick={() => setPeek(true)}>
                    Peek at the prompt
                  </Button>
                </div>
                <Dialog
                  open={peek}
                  onClose={() => setPeek(false)}
                  title="The AI prompt"
                  footer={
                    <>
                      <Button variant="ghost" onClick={() => setPeek(false)}>
                        Close
                      </Button>
                      <CopyButton
                        variant="primary"
                        text={() => planPrompt(today ?? todayIST())}
                        label="Copy the prompt"
                        copiedLabel="Copied. Paste it into your AI chat"
                      />
                    </>
                  }
                >
                  <Text variant="muted">
                    Paste this into any AI chat. It asks you a few questions first, then writes your plan.
                  </Text>
                  <pre className="mt-3 max-h-[55vh] overflow-auto rounded-md border border-line bg-sheet-2 p-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-2">
                    {today ? planPrompt(today) : ""}
                  </pre>
                </Dialog>
              </Step>

              <Step n={2} title="Save its reply as a file" delay={240}>
                <Text variant="muted">
                  When the AI answers with the plan (a block of JSON), save it as a file ending in **.json** (any name
                  will do) in any text editor. Answering its questions honestly makes a better plan.
                </Text>
              </Step>

              <Step n={3} title="Drop it here" delay={360}>
                <FileInput
                  accept=".json,application/json"
                  files={files}
                  onChange={setFiles}
                  title="Drop your plan file here"
                  description="Any .json file · checked the moment it lands"
                  buttonLabel="Choose the file"
                />
              </Step>
            </ol>

            {check && !plan && <ImportProblems kind="plan" errors={check.errors} />}

            {plan && sum && (
              <div className="special-border animate-flow-border grid animate-card-in gap-4 rounded-[22px] border-2 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-3xl motion-safe:animate-bob" aria-hidden="true">
                    🚀
                  </span>
                  <div className="min-w-0 flex-1">
                    <Heading level={2}>Ready for launch: {plan.name}</Heading>
                    <Text variant="muted">{`${formatLong(plan.starts_on)} → ${formatLong(plan.ends_on)}`}</Text>
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4">
                  <Stat value={sum.span} label="days in all" />
                  <Stat value={sum.days} label="planned days" />
                  <Stat value={sum.tasks} label="tasks" />
                  <Stat value={sum.milestones} label="milestones" />
                </div>
                {plan.milestones.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {plan.milestones.map((m) => (
                      <Pill key={m.name + m.date} tone="amber">{`${m.name} · ${formatLong(m.date)}`}</Pill>
                    ))}
                  </div>
                )}
                {check!.warnings.length > 0 && (
                  <Callout tone="info" title="Good to know">
                    <ul className="m-0 grid gap-1 pl-5">
                      {check!.warnings.map((w) => (
                        <li key={w}>
                          <Text as="span">{w}</Text>
                        </li>
                      ))}
                    </ul>
                  </Callout>
                )}
                <div className="flex flex-wrap gap-2.5">
                  <Button variant="special" size="lg" loading={launch.pending} onClick={go}>
                    Launch this plan
                  </Button>
                  <Button variant="ghost" onClick={() => setFiles([])}>
                    Pick another file
                  </Button>
                </div>
              </div>
            )}

            {process.env.NODE_ENV === "development" && (
              <div className={cx("flex flex-wrap items-center gap-2.5", !check && "opacity-70")}>
                <Pill tone="amber">DEV</Pill>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={sample.pending}
                  onClick={async () => {
                    if (await sample.run({ today: today ?? todayIST() })) onLaunched?.("Sample plan"); // same launch sequence
                  }}
                >
                  Skip all this: load the sample plan
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
