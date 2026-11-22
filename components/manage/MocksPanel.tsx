"use client";
// Manage pack → Mock tests (v1's MocksPanel): one small card per mock test, all the same size (its name, time,
// full screen, questions, sections, marks, times taken; clicking the card opens it) and "Add a mock test" below. Opening a mock shows
// its own page (MockDetail): its details (name, minutes, full screen, instructions), then its sections and
// questions, and Delete. The open mock is in the address (?mock=<id>), so Back returns to the cards; the view slides
// in from the right when a mock opens and from the left on the way back (styles/animations/manage-mocks.css).
// Ids are the system's (db/schema.sql), so a new mock needs only a name and its minutes. "Upload a mock test" loads
// a question file holding mock tests (the mock AI prompt writes one) as a pack, as Manage pack → Upload does.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ConfirmPhraseDialog } from "@/components/manage/ConfirmPhraseDialog";
import { MockDetail } from "@/components/manage/MockDetail";
import { PackUpload } from "@/components/manage/PackUpload";
import type { Celebration } from "@/components/practice/ImportCelebration";
import type { Overview } from "@/components/manage/QuestionsPanel";
import { IconArrowRight, IconLines, IconTrash, IconUpload } from "@/components/icons";
import {
  Button,
  Card,
  CopyButton,
  Dialog,
  Heading,
  Pill,
  Rich,
  StatTile,
  Text,
  TextField,
  useToast,
} from "@/components/ui";
import { useMutation, useQuery } from "@/lib/db/client";
import type { ResultOf } from "@/lib/db/queries";
import { DELETE_MOCKS_PHRASE } from "@/lib/manage";
import { questionsPrompt } from "@/lib/prompts/questionsPrompt";

type Mock = ResultOf<"manage.mocks">[number];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "2 hours", "90 min" (as on the Practice → Mocks cards). */
const duration = (minutes: number) =>
  minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}` : `${minutes} min`;

const num = (n: number) => String(Math.round(n * 100) / 100);

/** One mock on the list: the whole card opens it (Card onClick). Name and time up top, three numbers (questions,
 *  sections, marks), the sections by name, and how often you took it. Every card has the same parts, so a row of
 *  cards lines up whatever the mocks hold. */
function MockCard({ m, onOpen }: { m: Mock; onOpen: () => void }) {
  return (
    <Card onClick={onOpen} label={`Open ${m.name}`} className="group flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-accent-soft text-accent [&_svg]:size-[22px]">
          <IconLines />
        </span>
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Heading level={3} className="truncate">
            {m.name}
          </Heading>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone="accent">{duration(m.minutes)}</Pill>
            {m.full_screen && <Pill tone="red">Full screen</Pill>}
          </div>
        </div>
        <span className="mt-1 text-gray transition-[color,transform] duration-200 group-hover:translate-x-1 group-hover:text-accent [&_svg]:size-5">
          <IconArrowRight />
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile tone="accent" value={String(m.questions)} label={m.questions === 1 ? "question" : "questions"} />
        <StatTile value={String(m.sections.length)} label={m.sections.length === 1 ? "section" : "sections"} />
        <StatTile value={num(m.marks)} label="marks" />
      </div>

      <div className="truncate text-[0.88rem] text-ink-2">
        <Rich
          text={
            m.sections.length
              ? m.sections.map((x) => `${x.name} (${x.questions})`).join(" · ")
              : "No sections yet: open it to add one."
          }
        />
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-[0.85rem] text-gray">
        <Rich
          text={
            m.attempts
              ? `Taken ${m.attempts === 1 ? "once" : `${m.attempts} times`}${m.best !== null ? ` · best **${num(m.best)}** / ${num(m.marks)}` : ""}`
              : "Not taken yet"
          }
        />
        <span className="font-bold text-accent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Rich text="Open" />
        </span>
      </div>
    </Card>
  );
}

export function MocksPanel({ overview, onLoaded }: { overview: Overview; onLoaded: (c: Celebration) => void }) {
  const toast = useToast();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const open = sp.get("mock");
  const { data: mocks } = useQuery("manage.mocks");
  const add = useMutation("manage.addMock");
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("180");
  const [err, setErr] = useState("");
  const [wiping, setWiping] = useState(false); // the "Delete all mock tests" dialog is open
  const [uploading, setUploading] = useState(false); // the "Upload a mock test" dialog is open
  const wipe = useMutation("manage.emptyBank");
  // which way the last switch went (list → a mock, or back), so the new view slides in from that side; set while
  // rendering (React's "state from the previous render" pattern) so the first frame already animates
  const [shown, setShown] = useState(open);
  const [slide, setSlide] = useState<"open" | "back" | null>(null);
  if (shown !== open) {
    setShown(open);
    setSlide(open ? "open" : "back");
  }
  const anim = slide === "open" ? "animate-mock-open" : slide === "back" ? "animate-mock-back" : undefined;

  /** Delete all mock tests = empty the Mock bank (every mock and its mock-only questions; history stays). */
  const wipeAll = async () => {
    const r = await wipe.run({ bank: "mock" });
    if (!r) return false; // the hook already showed the error
    toast(`Deleted ${plural(r.mocks, "mock test")} and ${plural(r.questions, "mock question")}.`);
    return true;
  };

  /** Opens a mock (or goes back to the cards with null), in the address so Back works. */
  const go = (id: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (id) p.set("mock", id);
    else p.delete("mock");
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const addIt = async () => {
    const r = await add.run({ name, minutes });
    if (!r) return;
    if (!r.ok) return setErr(r.error);
    toast(`Added the mock test "${name.trim()}". Open it to add sections and questions.`, "success");
    setName("");
    setErr("");
  };

  if (open)
    return (
      <div key={open} className={anim}>
        <MockDetail overview={overview} mockId={open} onBack={() => go(null)} />
      </div>
    );
  if (!mocks) return null;
  return (
    <div key="list" className={anim}>
      <div className="flex flex-wrap items-center gap-3">
        <Text variant="muted" className="min-w-0 flex-[1_1_300px]">
          Each mock test owns its mock-only questions, and can use practice questions too. Open a mock to edit its
          sections and questions.
        </Text>
        {mocks.length > 0 && (
          <Button variant="danger" size="sm" icon={<IconTrash />} onClick={() => setWiping(true)}>
            Delete all mock tests
          </Button>
        )}
      </div>
      <ConfirmPhraseDialog
        open={wiping}
        onClose={() => setWiping(false)}
        title="Delete all mock tests?"
        phrase={DELETE_MOCKS_PHRASE}
        warning={`It deletes **every mock test** (${mocks.length}) and their mock-only questions. Practice questions they used stay in Practice. Your past mock results and answers stay in your stats. Use **Export pack** first if you might want them back.`}
        keepLabel="Keep them"
        confirmLabel="Delete all mock tests"
        pending={wipe.pending}
        onConfirm={wipeAll}
      />
      <div className="mt-2.5 mb-[22px] grid grid-cols-3 gap-3.5 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1">
        {mocks.map((m) => (
          <MockCard key={m.id} m={m} onOpen={() => go(m.id)} />
        ))}
      </div>
      {mocks.length === 0 && <Text variant="muted">No mock tests yet.</Text>}

      <Heading level={3} className="mt-5">
        Add a mock test
      </Heading>
      <div className="my-2 flex flex-wrap items-center gap-2">
        <TextField
          className="min-w-[140px] flex-[1_1_200px]"
          aria-label="Mock test name"
          placeholder="Name, e.g. Mock test 3"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addIt();
          }}
        />
        <TextField
          className="w-[110px]"
          aria-label="Minutes"
          inputMode="numeric"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <Button variant="primary" loading={add.pending} onClick={addIt}>
          Add mock test
        </Button>
        <Button variant="soft" icon={<IconUpload />} onClick={() => setUploading(true)}>
          Upload a mock test
        </Button>
      </div>
      <Dialog open={uploading} onClose={() => setUploading(false)} title="Upload a mock test" size="wide">
        <div className="grid gap-4">
          <Text variant="small" block>
            A mock test comes as a question file: its mock-only questions plus the test (name, minutes, sections). Copy
            the prompt into any AI chat, answer its questions, then drop or paste the JSON it gives back. Each file is
            loaded as its own pack (listed in **Upload**). A mock runs in full screen unless the file says
            `"full_screen": false`.
          </Text>
          <div>
            <CopyButton
              variant="primary"
              text={() => questionsPrompt("mocks")}
              label="Copy AI prompt: mock test"
              copiedLabel="Copied. Paste it into your AI chat"
            />
          </div>
          <PackUpload
            title="Drop your mock test file(s) here"
            hint={{
              noMocks: "This file holds **no mock test**: its questions still load, but no new card appears here.",
            }}
            onLoaded={(c) => {
              setUploading(false);
              onLoaded(c);
            }}
          />
        </div>
      </Dialog>
      {err && (
        <Text variant="error" className="my-2">
          {err}
        </Text>
      )}
    </div>
  );
}
