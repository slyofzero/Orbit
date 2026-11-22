"use client";
// Manage pack → Upload (v1's PackImport): your question packs (rename, export, remove), then the two steps to
// load more: get a question file from an AI, and upload or paste it. Files are checked the moment they land
// (lib/questionFile.ts) and saved with pack.import, one pack per file. Orbit can hold many packs; a question
// that is already in your bank is not added twice.

import { useState } from "react";
import { PackUpload } from "@/components/manage/PackUpload";
import type { Celebration } from "@/components/practice/ImportCelebration";
import { Button, Card, CopyButton, Table, Text, TextField, useToast, type Column } from "@/components/ui";
import { dbCall, useMutation, useQuery } from "@/lib/db/client";
import type { ResultOf } from "@/lib/db/queries";
import { formatDate, todayIST } from "@/lib/dates";
import { downloadText } from "@/lib/download";
import { fileNameOf } from "@/lib/manage";
import { questionsPrompt } from "@/lib/prompts/questionsPrompt";
import { LIMITS } from "@/lib/questionFile";

type Pack = ResultOf<"manage.packs">[number];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function UploadPanel({ onLoaded }: { onLoaded: (c: Celebration) => void }) {
  const toast = useToast();
  const { data: packs } = useQuery("manage.packs");
  const rename = useMutation("manage.renamePack");
  const remove = useMutation("manage.removePack");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [ask, setAsk] = useState<string | null>(null);

  const exportPack = async (p: Pack) => {
    try {
      const r = await dbCall("manage.export", { packId: p.id });
      if (!r) return toast("That pack is gone.", "error");
      downloadText(fileNameOf(p.name), JSON.stringify(r.file, null, 2));
      toast(`Exported ${plural(r.questions, "question")} to ${fileNameOf(p.name)}.`, "success");
    } catch (e) {
      toast(`Export failed: ${e instanceof Error ? e.message : String(e)}`, "error");
    }
  };

  const columns: Column<Pack>[] = [
    {
      key: "name",
      header: "Pack",
      cell: (p) =>
        renaming?.id === p.id ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await rename.run({ id: p.id, name: renaming.name });
              if (r && !r.ok) return toast(r.error, "error");
              if (r) toast(`The pack is now called "${renaming.name.trim()}".`, "success");
              setRenaming(null);
            }}
          >
            <TextField
              autoFocus
              aria-label="Pack name"
              maxLength={LIMITS.name}
              value={renaming.name}
              onChange={(e) => setRenaming({ id: p.id, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Escape") setRenaming(null);
              }}
            />
            <Button size="sm" variant="primary" type="submit" disabled={!renaming.name.trim()}>
              Save name
            </Button>
            <Button size="sm" variant="soft" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
          </form>
        ) : (
          <b>{p.name}</b>
        ),
    },
    { key: "file", header: "File", cell: (p) => p.file_name ?? "pasted" },
    { key: "when", header: "Loaded", cell: (p) => formatDate(todayIST(p.imported_at)) },
    { key: "questions", header: "Questions", align: "right", cell: (p) => String(p.questions) },
    { key: "mocks", header: "Mocks", align: "right", cell: (p) => String(p.mocks) },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (p) =>
        ask === p.id ? (
          <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
            <Text as="span" variant="small">
              {`🔴 Remove it with its ${plural(p.questions, "question")} and ${plural(p.mocks, "mock")}? Your past answers stay in your stats.`}
            </Text>
            <Button
              size="sm"
              variant="danger"
              loading={remove.pending}
              onClick={async () => {
                const r = await remove.run({ id: p.id });
                setAsk(null);
                if (r) toast(`Removed "${p.name}": ${plural(r.questions, "question")}, ${plural(r.mocks, "mock")}.`);
              }}
            >
              Yes, remove
            </Button>
            <Button size="sm" variant="soft" onClick={() => setAsk(null)}>
              No
            </Button>
          </span>
        ) : (
          <span className="inline-flex gap-1.5 whitespace-nowrap">
            <Button size="sm" variant="soft" onClick={() => setRenaming({ id: p.id, name: p.name })}>
              Rename
            </Button>
            <Button size="sm" variant="soft" onClick={() => exportPack(p)}>
              Export
            </Button>
            <Button size="sm" variant="soft" onClick={() => setAsk(p.id)}>
              Remove
            </Button>
          </span>
        ),
    },
  ];

  return (
    <div className="grid gap-4">
      <Card
        title="Your question packs"
        subtitle="Every file you loaded is one pack. Practice and Mocks show them all together."
      >
        <Table
          columns={columns}
          rows={packs ?? []}
          rowKey={(p) => p.id}
          empty="None loaded yet. Practice and Mocks stay empty until you upload a pack."
        />
      </Card>

      <Card title="1. Get a question file">
        <Text variant="small" block>
          A question file is one JSON file with your subjects, topics and questions (multiple choice, multiple select,
          numeric, short answer and programming), and optional mock tests. Let an AI write it for you: maths is written
          as LaTeX between dollar signs (the prompt explains how), and it is drawn in Practice and in mock tests.
        </Text>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton
            variant="primary"
            text={() => questionsPrompt("pack")}
            label="Copy AI prompt: whole pack"
            copiedLabel="Copied. Paste it into your AI chat"
          />
          <CopyButton
            variant="soft"
            text={() => questionsPrompt("topics")}
            label="Copy AI prompt: topic questions"
            copiedLabel="Copied. Paste it into your AI chat"
          />
          <CopyButton
            variant="soft"
            text={() => questionsPrompt("programming")}
            label="Copy AI prompt: programming"
            copiedLabel="Copied. Paste it into your AI chat"
          />
          <CopyButton
            variant="soft"
            text={() => questionsPrompt("mocks")}
            label="Copy AI prompt: mock test"
            copiedLabel="Copied. Paste it into your AI chat"
          />
        </div>
        <Text variant="small" className="mt-3.5">
          Paste the prompt into any AI chat, answer its questions, and upload or paste the JSON it gives back in step 2.
        </Text>
      </Card>

      <Card title="2. Upload or paste it">
        <PackUpload onLoaded={onLoaded} />
      </Card>
    </div>
  );
}
