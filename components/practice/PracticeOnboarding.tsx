"use client";
// What a Practice tab shows until its kind of question is loaded: an animated backdrop for the tab
// (components/background/PracticeScene.tsx) and three steps (ask an AI → save the file → drop it here), like
// the plan's welcome (PlanOnboarding). One component for all three tabs; only the words differ. Every tab hands
// out the same whole-pack prompt (practice, programming and mock tests in one file).
// A dropped file is checked at once (lib/questionFile.ts), previewed, and imported in one go (pack.import).
// Several files can be dropped together (the AI writes long sets in parts). The AI prompt is
// lib/prompts/questionsPrompt.ts.

import { useEffect, useState } from "react";
import { Step } from "@/components/dashboard/PlanOnboarding";
import { useScene, type SceneName } from "@/components/background/Backdrop";
import {
  Button,
  Callout,
  CopyButton,
  Dialog,
  FileInput,
  Heading,
  ImportProblems,
  Link,
  Pill,
  Stat,
  Text,
  useToast,
} from "@/components/ui";
import type { Celebration } from "@/components/practice/ImportCelebration";
import { useMutation } from "@/lib/db/client";
import type { PracticeTab } from "@/lib/practice";
import { questionsPrompt } from "@/lib/prompts/questionsPrompt";
import { parseQuestionFile, questionSummary, type QuestionParse } from "@/lib/questionFile";

type Copy = {
  scene: SceneName;
  icon: string;
  pill: string;
  before: string;
  word: string; // shown with the animated "special" colours
  after: string;
  lead: string;
  dropTitle: string;
  /** What a file must hold to fill this tab. */
  has: (s: ReturnType<typeof questionSummary>) => number;
  hasNone: string;
};

const COPY: Record<PracticeTab, Copy> = {
  topics: {
    scene: "practiceTopics",
    icon: "📚",
    pill: "No practice questions yet",
    before: "Practice starts with your ",
    word: "questions",
    after: ".",
    lead: "Topic practice is built from a question set that **you** load: your subjects, your topics and your questions (multiple choice, multiple select, numeric and short answer). Nothing is built in, so it works for any exam.",
    dropTitle: "Drop your question file here",
    has: (s) => s.practice,
    hasNone: "practice questions",
  },
  programming: {
    scene: "practiceProgramming",
    icon: "💻",
    pill: "No programming questions yet",
    before: "Code needs ",
    word: "problems",
    after: " to solve.",
    lead: "These are questions where you **write code** in an editor and then mark your own answer right or wrong. They come from a question file that you load, the same way as topic questions.",
    dropTitle: "Drop your programming questions here",
    has: (s) => s.programming,
    hasNone: "programming questions",
  },
  mocks: {
    scene: "practiceMocks",
    icon: "⏱️",
    pill: "No mock tests yet",
    before: "Mocks need a ",
    word: "paper",
    after: " to sit.",
    lead: "A full-length mock is a fixed paper with its own questions, sections and a countdown timer, shown on a screen that copies the real exam. Papers come from a file that **you** load, so they match your exam.",
    dropTitle: "Drop your mock test file here",
    has: (s) => s.mocks + s.mockQuestions,
    hasNone: "mock tests",
  },
};

const ASK =
  "Open any AI chat and paste the prompt. It asks what you are studying, then writes your **whole pack** in one file: **practice questions** by subject and topic, **programming questions** and **mock tests**. Say which parts you want: a part you don't want is simply left empty.";

const TAB_LINK: Record<PracticeTab, string> = {
  topics: "/practice?tab=topics",
  programming: "/practice?tab=programming",
  mocks: "/practice?tab=mocks",
};
const TAB_NAME: Record<PracticeTab, string> = { topics: "Topics", programming: "Programming", mocks: "Mocks" };

interface Checked {
  name: string;
  text: string;
  hash: string;
  parse: QuestionParse;
}
interface Done {
  added: number;
  existing: number;
  mocks: number;
  tabs: PracticeTab[]; // the tabs that now have something new
  warnings: string[];
  failed: string[];
}

/** SHA-256 of a file's text, in hex (finds the same file dropped twice). */
export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** `kind` is the tab that has nothing to show. */
export function PracticeOnboarding({
  kind,
  onLoaded,
}: {
  kind: PracticeTab;
  /** Called once something new was saved: the page plays the "loaded!" transition (ImportCelebration). */
  onLoaded?: (loaded: Celebration) => void;
}) {
  const c = COPY[kind];
  useScene(c.scene);
  const [peek, setPeek] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [checked, setChecked] = useState<Checked[]>([]);
  const [done, setDone] = useState<Done | null>(null);
  const imp = useMutation("pack.import");
  const addCode = useMutation("dev.addSampleCode");
  const addMock = useMutation("dev.addSampleMock");
  const toast = useToast();
  const [samplePending, setSamplePending] = useState(false);
  /** Imports the full sample pack (samples/questions/sample-full-pack.json: practice, programming and 2 mocks)
   *  like a dropped file. */
  const loadSamplePack = async (): Promise<Celebration | undefined> => {
    const { default: pack } = await import("@/samples/questions/sample-full-pack.json");
    const text = JSON.stringify(pack, null, 2);
    const r = await imp.run({ text, fileName: "sample-full-pack.json", fileHash: await sha256(text) });
    if (!r) return; // the hook already showed the error
    if (!r.ok) {
      toast(r.errors[0], "error");
      return;
    }
    return { questions: r.total, mocks: r.mocks };
  };
  // the dev shortcut of each tab: a sample of what the tab holds
  const sample: { label: string; go: () => Promise<Celebration | undefined> } = {
    topics: { label: "the full sample pack (32 practice, 7 programming, 2 mocks)", go: loadSamplePack },
    programming: {
      label: "one sample programming question",
      go: async () => ((await addCode.run()) ? { questions: 1, mocks: 0 } : undefined),
    },
    mocks: {
      label: "one sample mock",
      go: async () => ((await addMock.run()) ? { questions: 3, mocks: 1 } : undefined),
    },
  }[kind];

  // check every file as soon as it lands
  useEffect(() => {
    let live = true;
    if (!files.length) {
      setChecked([]);
      return;
    }
    Promise.all(
      files.map(async (f) => {
        const text = await f.text();
        return { name: f.name, text, hash: await sha256(text), parse: parseQuestionFile(text) };
      }),
    ).then((r) => live && (setChecked(r), setDone(null)));
    return () => {
      live = false;
    };
  }, [files]);

  const good = checked.filter((x) => x.parse.file);
  const bad = checked.filter((x) => !x.parse.file);
  const sums = good.map((x) => questionSummary(x.parse.file!));
  const total = sums.reduce(
    (a, s) => ({
      practice: a.practice + s.practice,
      programming: a.programming + s.programming,
      mockQuestions: a.mockQuestions + s.mockQuestions,
      mocks: a.mocks + s.mocks,
      topics: a.topics + s.topics,
      subjects: a.subjects + s.subjects,
    }),
    { practice: 0, programming: 0, mockQuestions: 0, mocks: 0, topics: 0, subjects: 0 },
  );
  const questions = total.practice + total.programming + total.mockQuestions;
  const warnings = [...new Set(good.flatMap((x) => x.parse.warnings))];
  const fillsTab = c.has(total) > 0;

  const go = async () => {
    const out: Done = { added: 0, existing: 0, mocks: 0, tabs: [], warnings: [], failed: [] };
    const tabs = new Set<PracticeTab>();
    for (const x of good) {
      const r = await imp.run({ text: x.text, fileName: x.name, fileHash: x.hash });
      if (!r) return; // the hook already showed the error
      if (!r.ok) {
        out.failed.push(`${x.name}: ${r.errors[0]}`);
        continue;
      }
      out.added += r.total;
      out.existing += r.existing;
      out.mocks += r.mocks;
      out.warnings.push(...r.warnings);
      if (r.practice) tabs.add("topics");
      if (r.programming) tabs.add("programming");
      if (r.mocks || r.mockQuestions) tabs.add("mocks");
    }
    out.tabs = [...tabs];
    out.warnings = [...new Set(out.warnings)];
    setFiles([]);
    setDone(out);
    if (out.added || out.mocks) onLoaded?.({ questions: out.added, mocks: out.mocks });
  };

  const prompt = () => questionsPrompt("pack");
  const stats: [number, string][] = (
    [
      [total.practice, "practice questions"],
      [total.programming, "programming questions"],
      [total.mockQuestions, "mock questions"],
      [total.mocks, "mock tests"],
      [total.topics, "topics"],
    ] as [number, string][]
  ).filter(([n]) => n > 0);

  return (
    <section className="max-w-[860px]">
      <div className="grid gap-7">
        <div className="grid animate-card-in justify-items-start gap-4">
          <Pill tone="accent">{`${c.icon} ${c.pill}`}</Pill>
          <Heading level={1} className="text-[clamp(2.1rem,4.6vw,3.3rem)] leading-[1.03] tracking-[-0.03em]">
            {c.before}
            <span className="special-text animate-flow">{c.word}</span>
            {c.after}
          </Heading>
          <Text className="max-w-[62ch] text-[1.06rem] text-ink-2" block>
            {c.lead}
          </Text>
        </div>

        <ol className="m-0 grid list-none gap-3.5 p-0">
          <Step n={1} title="Ask an AI to write them" delay={120}>
            <Text variant="muted" block>
              {ASK}
            </Text>
            <div className="flex flex-wrap items-center gap-2.5">
              <CopyButton
                variant="primary"
                text={prompt}
                label="Copy the AI prompt"
                copiedLabel="Copied. Paste it into your AI chat"
              />
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
                    text={prompt}
                    label="Copy the prompt"
                    copiedLabel="Copied. Paste it into your AI chat"
                  />
                </>
              }
            >
              <Text variant="muted">
                Paste this into any AI chat. It asks you a few questions first, then writes the file.
              </Text>
              <pre className="mt-3 max-h-[55vh] overflow-auto rounded-md border border-line bg-sheet-2 p-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-2">
                {peek ? prompt() : ""}
              </pre>
            </Dialog>
          </Step>

          <Step n={2} title="Save its reply as a file" delay={240}>
            <Text variant="muted" block>
              {`When the AI answers with a block of JSON, save it as a file ending in **.json** (any name will do) in any text editor. If it says it can't fit everything in one reply, ask it to continue and save each part as its own file: you can drop them all together.`}
            </Text>
          </Step>

          <Step n={3} title="Drop it here" delay={360}>
            <FileInput
              accept=".json,application/json"
              multiple
              files={files}
              onChange={setFiles}
              title={c.dropTitle}
              description="Any .json file · checked the moment it lands"
              buttonLabel="Choose the file"
            />
          </Step>
        </ol>

        {bad.map((x) => (
          <ImportProblems key={x.name} kind="questions" fileName={x.name} errors={x.parse.errors} />
        ))}

        {good.length > 0 && (
          <div className="special-border animate-flow-border grid animate-card-in gap-4 rounded-[22px] border-2 bg-sheet/80 p-5 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-3xl motion-safe:animate-bob" aria-hidden="true">
                {c.icon}
              </span>
              <div className="min-w-0 flex-1">
                <Heading level={2}>
                  {good.length === 1
                    ? `Ready to load: ${good[0].parse.file!.name}`
                    : `Ready to load ${good.length} files`}
                </Heading>
                <Text variant="muted">
                  {`${questions} question${questions === 1 ? "" : "s"}${total.mocks ? ` · ${total.mocks} mock test${total.mocks === 1 ? "" : "s"}` : ""} · ${total.subjects} subject${total.subjects === 1 ? "" : "s"}`}
                </Text>
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-4">
              {stats.map(([n, label]) => (
                <Stat key={label} value={n} label={label} />
              ))}
            </div>
            {good.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {good.map((x) => (
                  <Pill key={x.name} tone="neutral">{`${x.name} · ${x.parse.file!.questions.length}`}</Pill>
                ))}
              </div>
            )}
            {!fillsTab && (
              <Callout tone="warn" title={`There are no ${c.hasNone} in here`}>
                It will still be loaded, and shows up in the tab it belongs to. This tab stays empty until you load{" "}
                {c.hasNone}.
              </Callout>
            )}
            {warnings.length > 0 && (
              <Callout tone="info" title="Good to know">
                <ul className="m-0 grid gap-1 pl-5">
                  {warnings.map((w) => (
                    <li key={w}>
                      <Text as="span">{w}</Text>
                    </li>
                  ))}
                </ul>
              </Callout>
            )}
            <div className="flex flex-wrap gap-2.5">
              <Button variant="special" size="lg" loading={imp.pending} onClick={go}>
                {good.length === 1 ? "Load these questions" : `Load all ${good.length} files`}
              </Button>
              <Button variant="ghost" onClick={() => setFiles([])}>
                Pick other files
              </Button>
            </div>
          </div>
        )}

        {done && (
          <Callout
            tone={done.failed.length && !done.added && !done.mocks ? "warn" : "success"}
            title={
              done.added || done.mocks
                ? `Loaded ${done.added} question${done.added === 1 ? "" : "s"}${done.mocks ? ` and ${done.mocks} mock test${done.mocks === 1 ? "" : "s"}` : ""}`
                : "Nothing new was loaded"
            }
          >
            <ul className="m-0 grid gap-1 pl-5">
              {done.tabs.length > 0 && (
                <li>
                  <Text as="span">Open: </Text>
                  {done.tabs.map((t, i) => (
                    <span key={t}>
                      {i > 0 && ", "}
                      <Link href={TAB_LINK[t]}>{TAB_NAME[t]}</Link>
                    </span>
                  ))}
                </li>
              )}
              {[...done.failed, ...done.warnings].map((m) => (
                <li key={m}>
                  <Text as="span">{m}</Text>
                </li>
              ))}
            </ul>
          </Callout>
        )}

        {process.env.NODE_ENV === "development" && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Pill tone="amber">DEV</Pill>
            <Button
              size="sm"
              variant="ghost"
              loading={samplePending}
              onClick={async () => {
                setSamplePending(true);
                try {
                  const loaded = await sample.go();
                  if (loaded) onLoaded?.(loaded);
                } finally {
                  setSamplePending(false);
                }
              }}
            >
              {`Skip all this: add ${sample.label}`}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
