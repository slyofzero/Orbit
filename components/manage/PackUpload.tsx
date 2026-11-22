"use client";
// Upload or paste question files (orbit-questions, lib/questionFile.ts): each file is checked the moment it lands,
// a preview counts what it holds, and Load saves each one as its own pack (pack.import). Used by Manage pack →
// Upload (step 2) and by Mock tests → "Upload a mock test" (in a dialog). A mock may use questions already in the
// bank by id; the preview asks the bank (`pack.missing`) and refuses the file if one is found nowhere.

import { useEffect, useState } from "react";
import { sha256 } from "@/components/practice/PracticeOnboarding";
import type { Celebration } from "@/components/practice/ImportCelebration";
import { Button, Callout, FileInput, ImportProblems, Pill, StatTile, Text, TextArea } from "@/components/ui";
import { dbCall, useMutation } from "@/lib/db/client";
import {
  bankRefErrors,
  parseQuestionFile,
  questionSummary,
  type QuestionFile,
  type QuestionParse,
} from "@/lib/questionFile";

interface Checked {
  name: string;
  text: string;
  hash: string;
  parse: QuestionParse;
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Parses a file, then checks the mock question ids it doesn't hold itself against the bank. */
async function check(text: string): Promise<QuestionParse> {
  const parse = parseQuestionFile(text);
  if (!parse.file?.bankRefs.length) return parse;
  const missing = await dbCall("pack.missing", { ids: parse.file.bankRefs.map((b) => b.id) });
  const errors = bankRefErrors(parse.file, new Set(missing));
  return errors.length ? { file: null, errors, warnings: parse.warnings } : parse;
}

/** "45 min", "2 hours" for a mock's time. */
const duration = (m: number) => (m >= 60 && m % 60 === 0 ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${m} min`);

/** What a good file holds, before anything is saved: its name with a Ready pill, the question counts, each mock
 *  test on a line (time, sections, questions, full screen), then any warnings as plain lines. */
function Preview({ name, file, warnings }: { name: string; file: QuestionFile; warnings: string[] }) {
  const sum = questionSummary(file);
  const counts = (
    [
      [sum.practice, "practice questions"],
      [sum.programming, "programming questions"],
      [sum.mockQuestions, "mock-only questions"],
      [sum.topics, "topics"],
    ] as [number, string][]
  ).filter(([n]) => n > 0);
  return (
    <div className="grid gap-3.5 rounded-[18px] border-[1.5px] border-green bg-green-soft p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Pill tone="green">✓ Ready to load</Pill>
        <Text as="span" className="min-w-0 font-bold">
          {file.name}
        </Text>
        {name !== "Pasted text" && (
          <Text as="span" variant="hint">
            {name}
          </Text>
        )}
      </div>

      {counts.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
          {counts.map(([n, label]) => (
            <StatTile key={label} value={n} label={label} tone="accent" />
          ))}
        </div>
      )}

      {file.mocks.length > 0 && (
        <div className="grid gap-2">
          {file.mocks.map((m, i) => {
            const qs = m.sections.reduce((n, s) => n + s.questions.length, 0);
            return (
              <div
                key={`${m.name}:${i}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[14px] bg-sheet px-3.5 py-2.5"
              >
                <Text as="span" className="min-w-0 flex-[1_1_220px] font-bold">
                  {m.name}
                </Text>
                <span className="flex flex-wrap gap-1.5">
                  <Pill tone="neutral">{duration(m.minutes)}</Pill>
                  <Pill tone="neutral">{`${m.sections.length} section${m.sections.length === 1 ? "" : "s"}`}</Pill>
                  <Pill tone="neutral">{`${qs} question${qs === 1 ? "" : "s"}`}</Pill>
                  {m.full_screen && <Pill tone="accent">Full screen</Pill>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="grid gap-1 border-t border-line pt-3">
          {warnings.map((w) => (
            <Text key={w} variant="muted">
              {`ℹ️ ${w}`}
            </Text>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pasting is for one file's text; a huge one is better dropped as a file. */
const PASTE_MAX = 400_000;

export function PackUpload({
  onLoaded,
  title = "Drop your question file(s) here",
  hint,
}: {
  /** after a load that added something: the counts for the celebration */
  onLoaded: (c: Celebration) => void;
  /** the drop zone's title */
  title?: string;
  /** shown under the preview when the files hold no mock test (the mock dialog says so) */
  hint?: { noMocks: string };
}) {
  const imp = useMutation("pack.import");
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState<Checked[]>([]);
  const [done, setDone] = useState<string[] | null>(null);

  // check every file (and the pasted text) as soon as it lands
  useEffect(() => {
    let live = true;
    const sources: Promise<{ name: string; text: string }>[] = files.map(async (f) => ({
      name: f.name,
      text: await f.text(),
    }));
    if (text.trim()) sources.push(Promise.resolve({ name: "Pasted text", text }));
    Promise.all(sources)
      .then((all) =>
        Promise.all(all.map(async (x) => ({ ...x, hash: await sha256(x.text), parse: await check(x.text) }))),
      )
      .then((r) => {
        if (!live) return;
        setChecked(r);
        if (r.length) setDone(null);
      });
    return () => {
      live = false;
    };
  }, [files, text]);

  const good = checked.filter((x) => x.parse.file);
  const bad = checked.filter((x) => !x.parse.file);
  const sums = good.map((x) => questionSummary(x.parse.file!));
  const sum = (k: keyof ReturnType<typeof questionSummary>) => sums.reduce((n, s) => n + s[k], 0);
  const onlyMocks = good.length > 0 && sum("practice") + sum("programming") + sum("mockQuestions") === 0;
  const loadLabel =
    good.length > 1 ? `Load all ${good.length} files` : onlyMocks ? "Load this mock test" : "Load this pack";

  const load = async () => {
    const notes: string[] = [];
    let added = 0;
    let mocks = 0;
    for (const x of good) {
      const r = await imp.run({ text: x.text, fileName: x.name === "Pasted text" ? null : x.name, fileHash: x.hash });
      if (!r) return; // the hook already showed the error
      if (!r.ok) {
        notes.push(`${x.name}: ${r.errors[0]}`);
        continue;
      }
      added += r.total;
      mocks += r.mocks;
      notes.push(
        `${r.name}: ${plural(r.total, "new question")}${r.mocks ? `, ${plural(r.mocks, "mock test")}` : ""}.`,
        ...r.warnings,
      );
    }
    setFiles([]);
    setText("");
    setDone([...new Set(notes)]);
    if (added || mocks) onLoaded({ questions: added, mocks });
  };

  return (
    <div className="grid gap-3">
      <FileInput
        accept=".json,application/json"
        multiple
        files={files}
        onChange={setFiles}
        title={title}
        description="Pick several files at once to load them all · checked the moment they land"
        buttonLabel="Upload JSON file(s)"
      />
      <TextArea
        aria-label="Paste a question file"
        rows={8}
        spellCheck={false}
        placeholder='…or paste the JSON here, e.g. { "format": "orbit-questions", "name": "My pack", "questions": [ … ] }'
        value={
          text.length > PASTE_MAX
            ? `(${(text.length / 1e6).toFixed(1)} MB pasted: too big to show. Check the preview below, or press Clear.)`
            : text
        }
        readOnly={text.length > PASTE_MAX}
        onChange={(e) => setText(e.target.value)}
      />
      {(text || files.length > 0) && (
        <div>
          <Button
            variant="soft"
            size="sm"
            onClick={() => {
              setText("");
              setFiles([]);
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {bad.map((x) => (
        <ImportProblems key={x.name} kind="questions" fileName={x.name} errors={x.parse.errors} />
      ))}

      {good.map((x) => (
        <Preview key={x.name} name={x.name} file={x.parse.file!} warnings={x.parse.warnings} />
      ))}
      {good.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" loading={imp.pending} onClick={load}>
            {loadLabel}
          </Button>
          <Text variant="hint">
            {good.length === 1
              ? "Nothing is saved until you press this."
              : `${good.length} files, each saved as its own pack.`}
          </Text>
        </div>
      )}
      {hint && good.length > 0 && sum("mocks") === 0 && (
        <Callout tone="warn" title="No mock test in this file">
          {hint.noMocks}
        </Callout>
      )}

      {done && (
        <Callout tone="info" title="Loaded">
          <ul className="m-0 grid gap-1 pl-5">
            {done.map((m) => (
              <li key={m}>
                <Text as="span">{m}</Text>
              </li>
            ))}
          </ul>
        </Callout>
      )}
    </div>
  );
}
