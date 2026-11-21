"use client";
// Manage pack (v1's PackManager): the title row (Export pack, Delete pack, Back to practice), what is in the bank, and the
// sections as underlined tabs kept in the address. Each section is its own panel in components/manage/.
// The plan is edited from the Planner, not here.

import { useState } from "react";
import { ConfirmPhraseDialog } from "@/components/manage/ConfirmPhraseDialog";
import { MocksPanel } from "@/components/manage/MocksPanel";
import { QuestionsPanel } from "@/components/manage/QuestionsPanel";
import { TopicsPanel } from "@/components/manage/TopicsPanel";
import { UploadPanel } from "@/components/manage/UploadPanel";
import { ImportCelebration, type Celebration } from "@/components/practice/ImportCelebration";
import { IconChevronLeft, IconTrash } from "@/components/icons";
import { Button, EmptyState, Heading, Tabs, Text, useToast } from "@/components/ui";
import { useTab } from "@/components/utils/useTab";
import { dbCall, useMutation, useQuery } from "@/lib/db/client";
import { downloadText } from "@/lib/download";
import { DELETE_PHRASE, MANAGE_TABS, fileNameOf, type ManageTab } from "@/lib/manage";

const TAB_LABEL: Record<ManageTab, string> = {
  questions: "Questions",
  "mock-tests": "Mock tests",
  topics: "Topics",
  upload: "Upload",
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function ManagePack() {
  const toast = useToast();
  const [tab, setTab] = useTab(MANAGE_TABS, "questions");
  const { data } = useQuery("manage.overview");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false); // the "Delete pack" dialog is open
  const deleteAll = useMutation("manage.deleteAll");
  const [loaded, setLoaded] = useState<Celebration | null>(null);
  if (!data) return null;
  const c = data.counts;
  const empty = c.total === 0 && c.mocks === 0 && data.topics.length === 0;
  const needsPack = tab === "questions" || tab === "mock-tests" || tab === "topics";

  /** Delete pack: the whole question bank (ConfirmPhraseDialog only calls it once the phrase is typed). */
  const wipe = async () => {
    const r = await deleteAll.run();
    if (!r) return false; // the hook already showed the error
    toast(
      `Deleted the whole pack: ${plural(r.questions, "question")}, ${plural(r.mocks, "mock test")}, ${plural(r.packs, "pack")}.`,
    );
    return true;
  };

  /** v1's Export pack: the whole bank as one question file. */
  const exportAll = async () => {
    setExporting(true);
    try {
      const r = await dbCall("manage.export", { packId: null });
      if (!r) return;
      const name = fileNameOf(r.file.name);
      downloadText(name, JSON.stringify(r.file, null, 2));
      toast(
        `Exported ${plural(r.questions, "question")} and ${plural(r.mocks, "mock test")} to ${name}.${r.tooBig ? " It holds more than one file can import at once: split it before importing it again." : ""}`,
        r.tooBig ? "warm" : "success",
      );
    } catch (e) {
      toast(`Export failed: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-center gap-3">
        <Heading level={1}>Manage pack</Heading>
        <div className="ml-auto flex flex-wrap gap-2">
          {!empty && (
            <Button variant="soft" loading={exporting} onClick={exportAll}>
              Export pack
            </Button>
          )}
          {!empty && (
            <Button variant="danger" icon={<IconTrash />} onClick={() => setDeleting(true)}>
              Delete pack
            </Button>
          )}
          <Button variant="secondary" href="/practice" icon={<IconChevronLeft />}>
            Back to practice
          </Button>
        </div>
      </div>
      <Text variant="muted">
        {empty
          ? "No question pack yet."
          : `Your bank: ${plural(c.practice, "practice question")}, ${plural(c.programming, "programming question")}, ${plural(c.mocks, "mock test")}, ${plural(c.topics, "topic")}${c.packs ? ` from ${plural(c.packs, "pack")}` : ""}.`}
      </Text>

      <div className="mt-3.5 mb-[18px]">
        <Tabs
          shape="underline"
          label="Manage pack sections"
          value={tab}
          onChange={setTab}
          tabs={MANAGE_TABS.map((t) => ({ value: t, label: TAB_LABEL[t] }))}
        />
      </div>

      <div key={tab} className="animate-card-in">
        {needsPack && empty ? (
          <EmptyState
            icon="📦"
            title="There is no question pack yet."
            action={
              <Button variant="primary" onClick={() => setTab("upload")}>
                Upload one
              </Button>
            }
          />
        ) : tab === "questions" ? (
          <QuestionsPanel overview={data} />
        ) : tab === "topics" ? (
          <TopicsPanel overview={data} />
        ) : tab === "upload" ? (
          <UploadPanel onLoaded={setLoaded} />
        ) : (
          <MocksPanel overview={data} />
        )}
      </div>

      <ConfirmPhraseDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete the whole pack?"
        phrase={DELETE_PHRASE}
        warning={`It deletes **every** question (${plural(c.total, "question")}), mock test (${c.mocks}), topic and subject from Orbit, with all your answers, stats and mock results. Questions linked to your plan's days are unlinked. Your plan, its tasks and ticks stay. Use **Export pack** first if you might want them back.`}
        keepLabel="Keep my questions"
        confirmLabel="Delete everything"
        pending={deleteAll.pending}
        onConfirm={wipe}
      />

      {loaded && <ImportCelebration summary={loaded} onDone={() => setLoaded(null)} />}
    </>
  );
}
