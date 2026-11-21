"use client";
// Manage plan's title-row actions (v1's planner header): Link questions (v1 "Improve plan": copy an AI prompt with
// the plan and the bank, paste its reply back, apply), Unlink questions, Export plan and Upload plan (replace the
// plan with a new file). Locked days (past days, and today after the lock hour) keep their links throughout.
// Queries: lib/db/queries/planEdit.ts (plan.*) and plan.import; the prompt and the reply check: lib/planLinks.ts.

import { useEffect, useState } from "react";
import { Step } from "@/components/dashboard/PlanOnboarding";
import { IconUnlink } from "@/components/icons";
import {
  Button,
  Callout,
  CopyButton,
  Dialog,
  FileInput,
  ImportProblems,
  Pill,
  Spinner,
  Stat,
  Text,
  TextArea,
  useToast,
} from "@/components/ui";
import { dbCall, useMutation, useQuery } from "@/lib/db/client";
import type { ResultOf } from "@/lib/db/queries";
import { LOCK_HOUR } from "@/lib/dashboard";
import { formatLong, type IsoDate } from "@/lib/dates";
import { downloadText } from "@/lib/download";
import { fileNameOf } from "@/lib/manage";
import { parsePlanFile, planSummary, type PlanParse } from "@/lib/planFile";
import { isTooLong, linkFiles, linkPrompt } from "@/lib/planLinks";
import { planPrompt } from "@/lib/prompts/planPrompt";

export type Clock = { today: IsoDate; hour: number };
/** Set when Edit plan closes, read (and cleared) by Manage plan to slide in from the left: the way back. Lives in
 *  memory, so it only spans an in-app navigation, never a reload. */
export const pageNav = { leftEdit: false };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const LOCKED = `Past days, and today after ${LOCK_HOUR} AM, are locked and keep their links.`;

/** True while `open`, and for a moment after, so a dialog's body stays put while it fades out. */
function useMounted(open: boolean) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) return setMounted(true);
    const t = setTimeout(() => setMounted(false), 250);
    return () => clearTimeout(t);
  }, [open]);
  return mounted;
}

function Notes({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <Callout tone="info" title="Good to know">
      <ul className="m-0 grid gap-1 pl-5">
        {warnings.map((w) => (
          <li key={w}>
            <Text as="span">{w}</Text>
          </li>
        ))}
      </ul>
    </Callout>
  );
}

/** Export plan: the active plan as an orbit-plan file. */
export function useExportPlan() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const run = async () => {
    setPending(true);
    try {
      const r = await dbCall("plan.export");
      if (!r) return toast("There is no plan to export.", "error");
      const name = fileNameOf(`${r.name} plan`);
      downloadText(name, JSON.stringify(r.file, null, 2));
      toast(
        `Exported ${plural(r.days, "day")}, ${plural(r.tasks, "task")} and ${plural(r.links, "linked question")} to **${name}**. Ticks aren't in it: **Export progress** on the dashboard keeps those.`,
        "success",
      );
    } catch (e) {
      toast(`Export failed: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setPending(false);
    }
  };
  return { run, pending };
}

/** Unlink questions: a CAUTION, then every open day loses its links. */
export function UnlinkQuestions({ open, onClose, clock }: { open: boolean; onClose: () => void; clock: Clock }) {
  const toast = useToast();
  const unlink = useMutation("plan.unlinkAll");
  const go = async () => {
    const r = await unlink.run(clock);
    if (!r) return;
    toast(
      r.days
        ? `Unlinked ${plural(r.links, "question")} from ${plural(r.days, "day")}.${r.kept ? ` ${plural(r.kept, "locked day")} kept ${r.kept === 1 ? "its" : "their"} links.` : ""}`
        : `Nothing to unlink: only locked days have links, and they keep them.`,
      r.days ? "success" : "neutral",
    );
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Unlink questions?"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            Keep them
          </Button>
          <Button variant="danger" icon={<IconUnlink />} loading={unlink.pending} onClick={go}>
            Unlink questions
          </Button>
        </>
      }
    >
      <Callout tone="caution" title="🔴 CAUTION">
        <Text>{`This removes the linked questions from **every open day** of your plan. ${LOCKED} Your questions, answers, tasks and ticks all stay. You can link again any time with **Link questions**.`}</Text>
      </Callout>
    </Dialog>
  );
}

/** Link questions: the AI prompt (or two files when it is too long), the reply pasted back, checked, applied. */
export function LinkQuestions({ open, onClose, clock }: { open: boolean; onClose: () => void; clock: Clock }) {
  const mounted = useMounted(open);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="wide"
      title="Link questions with AI"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      {mounted && <LinkBody clock={clock} onDone={onClose} />}
    </Dialog>
  );
}

type Check = NonNullable<ResultOf<"plan.checkLinks">>;

function LinkBody({ clock, onDone }: { clock: Clock; onDone: () => void }) {
  const toast = useToast();
  const { data } = useQuery("plan.linkInput", clock);
  const apply = useMutation("plan.applyLinks");
  const [text, setText] = useState("");
  const [check, setCheck] = useState<Check | null>(null);

  // check the pasted reply against the plan and the bank, a moment after typing stops
  useEffect(() => {
    if (!text.trim()) return setCheck(null);
    let live = true;
    const t = setTimeout(async () => {
      const r = await dbCall("plan.checkLinks", { ...clock, text }).catch(() => null);
      if (live) setCheck(r);
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [text, clock]);

  if (data === undefined) return <Spinner label="Reading your plan and questions" />;
  if (data === null) return <Text variant="muted">There is no plan yet. Upload one first.</Text>;
  const { input, open, linkedOpen } = data;
  if (!input.questions.length)
    return (
      <div className="grid justify-items-start gap-3">
        <Text>Your question bank is empty, so there is nothing to link yet. Load a question pack first.</Text>
        <Button variant="primary" href="/practice">
          Go to practice
        </Button>
      </div>
    );
  if (!open) return <Text>{`Every day of your plan is locked, so there is nothing left to link. ${LOCKED}`}</Text>;

  const prompt = linkPrompt(input);
  const tooLong = isTooLong(prompt);
  const files = () => {
    const f = linkFiles(input);
    downloadText("plan.json", JSON.stringify(f.plan, null, 2));
    setTimeout(() => downloadText("question-bank.json", JSON.stringify(f.bank, null, 2)), 400); // two downloads in a row
    toast("Saved **plan.json** and **question-bank.json**. Attach both to your AI chat.", "success");
  };
  const go = async () => {
    const r = await apply.run({ ...clock, text });
    if (!r) return;
    if (!r.ok) return setCheck({ errors: r.errors, warnings: [], days: 0, questions: 0 });
    toast(
      `Linked ${plural(r.questions, "different question")} to ${plural(r.days, "day")}.${r.cleared ? ` ${plural(r.cleared, "day")} the AI left out lost ${r.cleared === 1 ? "its" : "their"} old links.` : ""}`,
      "success",
    );
    onDone();
  };

  return (
    <div className="grid gap-4">
      <Text variant="muted">
        Your plan says what to study. An AI can add exactly which questions to solve each day. Ticking happens by
        itself: a linked question counts as done once you answer it.
      </Text>
      <ol className="m-0 grid list-none gap-6 p-0">
        <Step n={1} title={tooLong ? "Send two files to an AI" : "Give this to an AI"} delay={0} bare>
          {tooLong ? (
            <>
              <Text variant="muted">
                {`Your bank is too big to paste in one go (${Math.round(prompt.length / 1000)}k characters). Save these two files, attach both to any AI chat, then paste the short prompt.`}
              </Text>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={files}>
                  Save the two files
                </Button>
                <CopyButton
                  text={() => linkFiles(input).prompt}
                  label="Copy the short prompt"
                  copiedLabel="Copied. Paste it with the files"
                />
              </div>
            </>
          ) : (
            <>
              <Text variant="muted">
                {`It holds the instructions, your plan's ${plural(open, "open day")} and your ${plural(input.questions.length, "practice question")}${linkedOpen ? `, with the ${plural(linkedOpen, "day")} linked now so the AI can improve them` : ""} (${Math.round(prompt.length / 1000)}k characters).`}
              </Text>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  variant="primary"
                  text={() => prompt}
                  label="Copy the AI prompt"
                  copiedLabel="Copied. Paste it into your AI chat"
                />
                <Button variant="soft" onClick={files}>
                  Or save it as two files
                </Button>
              </div>
            </>
          )}
        </Step>
        <Step n={2} title="Paste its answer" delay={0} bare>
          <Text variant="muted">The AI replies with a short block of JSON. Paste all of it here.</Text>
          <TextArea
            aria-label="The AI's answer"
            spellCheck={false}
            rows={7}
            className="font-mono text-xs"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{ "days": [ { "date": "2026-11-08", "questions": ["q_ab12cd34ef56"] } ] }'
          />
        </Step>
        <Step n={3} title="Bring it in" delay={0} bare>
          {!check ? (
            <Text variant="muted">{`Your days fill with real questions. ${LOCKED}`}</Text>
          ) : check.errors.length ? (
            <Callout tone="caution" title="🔴 Fix this first">
              <ul className="m-0 grid gap-1 pl-5">
                {check.errors.map((e) => (
                  <li key={e}>
                    <Text as="span">{e}</Text>
                  </li>
                ))}
              </ul>
            </Callout>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Pill tone="green">{plural(check.days, "day")}</Pill>
                <Pill tone="blue">{plural(check.questions, "different question")}</Pill>
              </div>
              <Notes warnings={check.warnings} />
              {linkedOpen > 0 && (
                <Callout tone="caution" title="🔴 CAUTION">
                  <Text>{`Applying this **replaces** the links of every open day (${plural(linkedOpen, "day")} linked now): an open day the answer leaves out loses its links. ${LOCKED} Your tasks, ticks and answers are kept.`}</Text>
                </Callout>
              )}
              <div>
                <Button variant="primary" loading={apply.pending} onClick={go}>
                  Apply links
                </Button>
              </div>
            </>
          )}
        </Step>
      </ol>
    </div>
  );
}

/** Upload plan: a new plan file replaces the active plan, after a CAUTION. */
export function UploadPlan({
  open,
  onClose,
  clock,
  current,
}: {
  open: boolean;
  onClose: () => void;
  clock: Clock;
  current: string | null; // the active plan's name (null = none)
}) {
  const toast = useToast();
  const launch = useMutation("plan.import");
  const [files, setFiles] = useState<File[]>([]);
  const [pasted, setPasted] = useState("");
  const [text, setText] = useState("");
  const [check, setCheck] = useState<PlanParse | null>(null);

  // check the file (or the pasted text) as soon as it lands
  useEffect(() => {
    const f = files[0];
    if (!f) {
      setText(pasted);
      return setCheck(pasted.trim() ? parsePlanFile(pasted) : null);
    }
    let live = true;
    f.text().then((t) => {
      if (!live) return;
      setText(t);
      setCheck(parsePlanFile(t));
    });
    return () => {
      live = false;
    };
  }, [files, pasted]);

  const close = () => {
    setFiles([]);
    setPasted("");
    onClose();
  };
  const plan = check?.plan ?? null;
  const sum = plan ? planSummary(plan) : null;
  const go = async () => {
    const r = await launch.run({ text });
    if (!r) return;
    if (!r.ok) return setCheck({ plan: null, errors: r.errors, warnings: r.warnings });
    toast(
      `**${r.name}** is your plan now: ${plural(r.days, "day")}, ${plural(r.tasks, "task")}${r.links ? `, ${plural(r.links, "linked question")}` : ""}.`,
      "special",
    );
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      size="wide"
      title="Upload a new plan"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!plan} loading={launch.pending} onClick={go}>
            {current ? "Replace my plan" : "Use this plan"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <ol className="m-0 grid list-none gap-6 p-0">
          <Step n={1} title="Ask an AI to draft it" delay={0} bare>
            <Text variant="muted">
              Copy this prompt into any AI chat. It asks about your goal, your dates and your free time, then writes the
              whole plan. Already have a plan file (from **Export plan**, say)? Skip to step 2.
            </Text>
            <div>
              <CopyButton
                text={() => planPrompt(clock.today)}
                label="Copy the AI prompt"
                copiedLabel="Copied. Paste it into your AI chat"
              />
            </div>
          </Step>
          <Step n={2} title="Drop the file here, or paste it" delay={0} bare>
            <FileInput
              accept=".json,application/json"
              files={files}
              onChange={setFiles}
              title="Drop your plan file here"
              description="Any .json file · checked the moment it lands"
              buttonLabel="Choose the file"
            />
            {!files.length && (
              <TextArea
                aria-label="Or paste the plan here"
                spellCheck={false}
                rows={4}
                className="font-mono text-xs"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder='…or paste it: { "format": "orbit-plan", "name": "…", "days": [ … ] }'
              />
            )}
          </Step>
        </ol>

        {check && !plan && <ImportProblems kind="plan" errors={check.errors} fileName={files[0]?.name} />}

        {plan && sum && (
          <div className="grid gap-3.5 rounded-lg border border-line p-4">
            <div>
              <Text className="font-bold">{plan.name}</Text>
              <Text variant="muted">{`${formatLong(plan.starts_on)} → ${formatLong(plan.ends_on)}`}</Text>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-4">
              <Stat value={sum.span} label="days in all" />
              <Stat value={sum.days} label="planned days" />
              <Stat value={sum.tasks} label="tasks" />
              <Stat value={sum.milestones} label="milestones" />
            </div>
            <Notes warnings={check!.warnings} />
            {current && (
              <Callout tone="caution" title="🔴 CAUTION">
                <Text>{`This **replaces** your plan **${current}**: its days, tasks, ticks, linked questions and milestones stop showing. Your questions and answers stay. Use **Export plan** first if you might want it back.`}</Text>
              </Callout>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
