"use client";
// Manage pack → Questions (v1's QuestionsPanel): three banks, each question in exactly one (lib/manage.ts
// QUESTION_BANKS): Practice, Programming (code questions) and Mock (mock-only questions; filter by mock). Find a
// question by id or text, filter by topic, then edit or delete it, or add a new one; "Empty" clears the whole
// bank after you type its phrase. ?q=<id> in the address opens that question. Clicking a row opens that one
// question in a new tab (`openHref`). Shown in pages of MANAGE_PAGE (20)
// rows, so a big pack never loads all at once; changing the bank, search or a filter goes back to page 1.

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmPhraseDialog } from "@/components/manage/ConfirmPhraseDialog";
import { QuestionEditor } from "@/components/manage/QuestionEditor";
import { IconChevronLeft, IconChevronRight, IconPlus, IconTrash } from "@/components/icons";
import { Button, Code, Dropdown, Rich, SearchField, Table, Tabs, Text, useToast, type Column } from "@/components/ui";
import { useMutation, useQuery } from "@/lib/db/client";
import type { ResultOf } from "@/lib/db/queries";
import {
  BANK_LABEL,
  MANAGE_PAGE,
  QUESTION_BANKS,
  emptyPhrase,
  pageOf,
  previewText,
  type QuestionBank,
} from "@/lib/manage";
import type { QuestionType } from "@/types/tables";

export type Overview = ResultOf<"manage.overview">;
type Row = ResultOf<"manage.questions">["rows"][number];
/** Which question the editor is open on: an id, a new one (starting in a bank), or none. */
type Editing =
  | { id: string }
  | { id: null; preset?: { mockId: string; sectionId: number | null }; type?: QuestionType }
  | null;
/** Where a row opens (new tab): a practice question as a sitting of just itself, a code question on its
 *  Programming screen, a mock-only question (no practice screen of its own) in the editor here. */
const openHref = (r: Row) =>
  r.pool === "mock"
    ? `/practice/manage?q=${encodeURIComponent(r.id)}`
    : r.type === "code"
      ? `/practice/code?id=${encodeURIComponent(r.id)}`
      : `/practice/session?q=${encodeURIComponent(r.id)}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function QuestionsPanel({ overview }: { overview: Overview }) {
  const toast = useToast();
  const focusId = useSearchParams().get("q");
  const [bank, setBank] = useState<QuestionBank>("practice");
  const [needle, setNeedle] = useState(focusId ?? "");
  const [mockId, setMockId] = useState(""); // Mock bank only: "" = every mock
  const [topic, setTopic] = useState("");
  const [page, setPage] = useState(0); // 0-based
  const [edit, setEdit] = useState<Editing>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [emptying, setEmptying] = useState(false);
  const remove = useMutation("manage.removeQuestion");
  const empty = useMutation("manage.emptyBank");
  const { data } = useQuery("manage.questions", {
    search: needle,
    bank,
    mockId: bank === "mock" && mockId ? mockId : null,
    topicId: topic || null,
    limit: MANAGE_PAGE,
    offset: page * MANAGE_PAGE,
  });
  const pager = pageOf(data?.matched ?? 0, page);
  const counts: Record<QuestionBank, number> = {
    practice: overview.counts.practice,
    programming: overview.counts.programming,
    mock: overview.counts.mockQuestions,
  };
  const inBank = counts[bank] + (bank === "mock" ? overview.counts.mocks : 0);

  useEffect(() => {
    if (focusId) setEdit({ id: focusId });
  }, [focusId]);
  // the list shrank under this page (a delete, another tab): go to its new last page
  useEffect(() => {
    if (data && page > 0 && page !== pager.page) setPage(pager.page);
  }, [data, page, pager.page]);

  const reset = () => setPage(0);
  const del = async (id: string) => {
    const r = await remove.run({ id });
    setConfirm(null);
    if (r) toast(r.retired ? `Deleted ${id}. Your past answers to it are kept in your stats.` : `Deleted ${id}.`);
  };
  /** A new question starts in the bank on screen: a code question in Programming, the picked mock in Mock. */
  const addNew = () => {
    if (bank === "programming") return setEdit({ id: null, type: "code" });
    const m = bank === "mock" ? (overview.mocks.find((x) => x.id === mockId) ?? overview.mocks[0]) : undefined;
    setEdit({ id: null, preset: m ? { mockId: m.id, sectionId: m.sections[0]?.id ?? null } : undefined });
  };
  const emptyIt = async () => {
    const r = await empty.run({ bank });
    if (!r) return false; // the hook already showed the error
    reset();
    toast(
      `Emptied ${BANK_LABEL[bank]}: ${plural(r.questions, "question")}${bank === "mock" ? ` and ${plural(r.mocks, "mock test")}` : ""} removed.`,
    );
    return true;
  };

  const columns: Column<Row>[] = [
    { key: "id", header: "Id", cell: (r) => <Code>{r.id}</Code> },
    ...(bank === "mock"
      ? [
          {
            key: "place",
            header: "Mock",
            cell: (r: Row) => (
              <span className="block max-w-[200px] truncate text-gray" title={r.place ?? ""}>
                <Rich text={r.place ?? "Not in a mock test"} />
              </span>
            ),
          },
        ]
      : []),
    { key: "topic", header: "Topic", cell: (r) => r.topic_name },
    {
      key: "type",
      header: "Type",
      cell: (r) => <span className="whitespace-nowrap">{`${r.type.toUpperCase()} · ${r.marks}m`}</span>,
    },
    { key: "text", header: "Question", cell: (r) => <Rich text={previewText(r.stem, 90)} /> },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (r) =>
        confirm === r.id ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Text as="span">Delete?</Text>
            <Button size="sm" variant="danger" loading={remove.pending} onClick={() => del(r.id)}>
              Yes
            </Button>
            <Button size="sm" variant="soft" onClick={() => setConfirm(null)}>
              No
            </Button>
          </span>
        ) : (
          <span className="inline-flex gap-1.5 whitespace-nowrap">
            <Button size="sm" variant="soft" onClick={() => setEdit({ id: r.id })}>
              Edit
            </Button>
            <Button size="sm" variant="soft" onClick={() => setConfirm(r.id)}>
              Delete
            </Button>
          </span>
        ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Tabs
          shape="bar"
          label="Question banks"
          value={bank}
          onChange={(b) => {
            setBank(b);
            setConfirm(null);
            reset();
          }}
          tabs={QUESTION_BANKS.map((b) => ({ value: b, label: BANK_LABEL[b], count: counts[b] }))}
        />
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          icon={<IconTrash />}
          disabled={inBank === 0}
          onClick={() => setEmptying(true)}
        >
          {`Empty ${BANK_LABEL[bank]}`}
        </Button>
      </div>

      <div className="my-2 flex flex-wrap items-center gap-2">
        <SearchField
          label="Find a question"
          className="min-w-[200px] flex-1"
          value={needle}
          onChange={(v) => {
            setNeedle(v);
            reset();
          }}
          placeholder="Find by id or text, e.g. q_3f9a"
        />
        {bank === "mock" && (
          <div className="w-[210px]">
            <Dropdown
              value={mockId}
              onChange={(v) => {
                setMockId(v);
                reset();
              }}
              options={[
                { value: "", label: "All mocks" },
                ...overview.mocks.map((m) => ({ value: m.id, label: m.name })),
              ]}
            />
          </div>
        )}
        <div className="w-[250px]">
          <Dropdown
            searchable
            value={topic}
            onChange={(v) => {
              setTopic(v);
              reset();
            }}
            options={[
              { value: "", label: "All topics" },
              ...overview.topics.map((t) => ({ value: t.id, label: t.name, group: t.subject_name })),
            ]}
          />
        </div>
        <Button variant="primary" icon={<IconPlus />} disabled={overview.topics.length === 0} onClick={addNew}>
          Add question
        </Button>
      </div>
      {overview.topics.length === 0 && (
        <Text variant="small">Add a topic first (Topics tab). Every question needs one.</Text>
      )}
      <Text variant="small" className="mb-2.5">
        {data
          ? `${data.matched} of ${data.total} ${BANK_LABEL[bank].toLowerCase()} questions. Every question has one id, unique across all banks, and sits in exactly one bank. Click a row to open it in a new tab.`
          : " "}
      </Text>

      {data && (
        <Table columns={columns} rows={data.rows} rowKey={(r) => r.id} rowHref={openHref} empty="Nothing matches." />
      )}
      {data && pager.pages > 1 && (
        <nav aria-label="Pages of questions" className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
          <Button
            variant="soft"
            size="sm"
            icon={<IconChevronLeft />}
            disabled={pager.page === 0}
            onClick={() => setPage(pager.page - 1)}
          >
            Previous
          </Button>
          <Text as="span" variant="small">
            {`Page ${pager.page + 1} of ${pager.pages} · ${pager.first}–${pager.last} of ${data.matched}`}
          </Text>
          <Button
            variant="soft"
            size="sm"
            iconAfter={<IconChevronRight />}
            disabled={pager.page >= pager.pages - 1}
            onClick={() => setPage(pager.page + 1)}
          >
            Next
          </Button>
        </nav>
      )}

      <ConfirmPhraseDialog
        open={emptying}
        onClose={() => setEmptying(false)}
        title={`Empty ${BANK_LABEL[bank]}?`}
        phrase={emptyPhrase(bank)}
        warning={
          bank === "mock"
            ? `It removes **every mock test** (${overview.counts.mocks}) and all ${plural(counts.mock, "mock question")}. Practice and Programming are not touched. Your past mock results and answers stay in your stats. Use **Export pack** first if you might want them back.`
            : `It removes all ${plural(counts[bank], `${BANK_LABEL[bank].toLowerCase()} question`)} (and takes them out of any mock and any unticked plan day). The other banks are not touched. Your past answers stay in your stats. Use **Export pack** first if you might want them back.`
        }
        keepLabel="Keep them"
        confirmLabel={`Empty ${BANK_LABEL[bank]}`}
        pending={empty.pending}
        onConfirm={emptyIt}
      />

      {edit && (
        <QuestionEditor
          overview={overview}
          id={edit.id}
          preset={edit.id === null ? edit.preset : undefined}
          startType={edit.id === null ? edit.type : undefined}
          onClose={() => setEdit(null)}
          onSaved={(id) => {
            setEdit(null);
            toast(`Saved ${id}.`, "success");
          }}
        />
      )}
    </>
  );
}
