"use client";
// Manage pack → Mock tests → one mock (v1's MockDetail): its details (name, minutes, full screen, instructions:
// v1 had these on the card), then its sections and questions in the order the exam runs them. Delete mock test
// (top right) asks first, then goes back to the list. Rename (saves when you leave the box), move or delete a section; move, edit or delete a question; add a
// question to a section (QuestionEditor with `preset`); add a section. Deleting a mock-only question deletes it;
// a practice question used here is only taken out of this mock ("Remove") and stays in Practice.

import { useState } from "react";
import { QuestionEditor } from "@/components/manage/QuestionEditor";
import type { Overview } from "@/components/manage/QuestionsPanel";
import { IconChevronDown, IconChevronLeft, IconPlus, IconTrash } from "@/components/icons";
import {
  Button,
  Card,
  Code,
  Dialog,
  Heading,
  IconButton,
  Pill,
  Rich,
  Switch,
  Table,
  Text,
  TextArea,
  TextField,
  useToast,
  type Column,
} from "@/components/ui";
import { useMutation, useQuery } from "@/lib/db/client";
import type { ResultOf } from "@/lib/db/queries";
import { checkMock, previewText } from "@/lib/manage";
import { LIMITS } from "@/lib/questionFile";

type Section = NonNullable<ResultOf<"manage.mock">>["sections"][number];
type Item = Section["questions"][number];
/** The editor: an existing question, or a new one in a section. */
type Editing = { id: string } | { id: null; sectionId: number } | null;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
type MockInfo = NonNullable<ResultOf<"manage.mock">>["mock"];

/** The mock's details (v1's card fields): name, minutes, full screen, instructions, saved together. Keyed by its saved
 *  values by its parent, so it shows them again after a save (and keeps unsaved typing when sections change). */
function DetailsCard({ mock }: { mock: MockInfo }) {
  const toast = useToast();
  const save = useMutation("manage.saveMock");
  const [name, setName] = useState(mock.name);
  const [minutes, setMinutes] = useState(String(mock.minutes));
  const [instructions, setInstructions] = useState(mock.instructions ?? "");
  const [fullScreen, setFullScreen] = useState(mock.full_screen);
  const [err, setErr] = useState("");
  const check = checkMock({ name, minutes, instructions });
  const dirty =
    name !== mock.name ||
    minutes !== String(mock.minutes) ||
    instructions !== (mock.instructions ?? "") ||
    fullScreen !== mock.full_screen;

  const saveIt = async () => {
    if (!check.ok) return setErr(check.error);
    const r = await save.run({ id: mock.id, name, minutes, instructions, fullScreen });
    if (!r) return; // the hook already showed the error
    if (!r.ok) return setErr(r.error);
    toast(`Saved "${name.trim()}".`, "success");
  };

  return (
    <Card title="Details" className="my-3.5">
      <div className="grid gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_140px_auto] items-end gap-3 max-[640px]:grid-cols-1">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Minutes" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          <div className="pb-2">
            <Switch checked={fullScreen} onChange={setFullScreen} label="Full screen" />
          </div>
        </div>
        <TextArea
          label="Instructions"
          hint="Shown before the test starts. Markdown and LaTeX work. Leave empty for none."
          rows={3}
          maxLength={LIMITS.instructions}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        {(err || (dirty && !check.ok)) && (
          <div role="alert">
            <Text variant="error">{err || (check.ok ? "" : check.error)}</Text>
          </div>
        )}
        <div>
          <Button variant="primary" loading={save.pending} disabled={!dirty || !check.ok} onClick={saveIt}>
            Save details
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function MockDetail({ overview, mockId, onBack }: { overview: Overview; mockId: string; onBack: () => void }) {
  const toast = useToast();
  const { data } = useQuery("manage.mock", { id: mockId });
  const rename = useMutation("manage.renameSection");
  const moveSection = useMutation("manage.moveSection");
  const removeSection = useMutation("manage.removeSection");
  const addSection = useMutation("manage.addSection");
  const moveItem = useMutation("manage.moveItem");
  const removeItem = useMutation("manage.removeItem");
  const [edit, setEdit] = useState<Editing>(null);
  const [confirm, setConfirm] = useState<string | null>(null); // "q:<section>:<id>" or "s:<section>"
  const [newSec, setNewSec] = useState("");
  const [msg, setMsg] = useState("");
  const removeMock = useMutation("manage.removeMock");
  const [asking, setAsking] = useState(false); // the "Delete mock test" dialog is open
  const [deleted, setDeleted] = useState(false); // gone on purpose: go back without the "it is gone" note

  const back = (
    <Button variant="secondary" icon={<IconChevronLeft />} onClick={onBack}>
      All mock tests
    </Button>
  );
  if (data === undefined || deleted) return null;
  if (data === null)
    return (
      <div className="grid justify-items-start gap-2">
        <Text variant="muted">That mock test is gone (it was deleted, maybe in another tab).</Text>
        {back}
      </div>
    );
  const { mock, sections } = data;
  const own = sections.reduce((n, s) => n + s.questions.filter((q) => q.pool === "mock").length, 0);
  const practiceUsed = data.questions - own;

  const delMock = async () => {
    const r = await removeMock.run({ id: mockId });
    if (!r) return; // the hook already showed the error
    setAsking(false);
    if (!r.ok) return toast(r.error, "error");
    setDeleted(true);
    toast(`Deleted "${mock.name}". Your past results on it are kept in your stats.`);
    onBack();
  };

  const add = async () => {
    const r = await addSection.run({ mockId, name: newSec });
    if (!r) return;
    if (!r.ok) return setMsg(r.error);
    setNewSec("");
    setMsg("");
  };
  const delSection = async (s: Section) => {
    const r = await removeSection.run({ id: s.id });
    setConfirm(null);
    if (r) toast(`Deleted the section "${s.name}"${r.questions ? ` and ${plural(r.questions, "question")}` : ""}.`);
  };
  const delItem = async (s: Section, q: Item) => {
    const r = await removeItem.run({ sectionId: s.id, questionId: q.id });
    setConfirm(null);
    if (!r) return;
    toast(
      r.deleted
        ? `Deleted ${q.id}.${r.retired ? " Your past answers to it are kept in your stats." : ""}`
        : `Took ${q.id} out of this mock. It is still in Practice.`,
    );
  };

  const columns = (s: Section): Column<Item>[] => [
    {
      key: "n",
      header: "#",
      cell: (q) => (
        <Text as="span" variant="small">
          {String(s.questions.indexOf(q) + 1)}
        </Text>
      ),
    },
    {
      key: "id",
      header: "Id",
      cell: (q) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Code>{q.id}</Code>
          {q.pool === "practice" && <Pill tone="blue">Practice</Pill>}
        </span>
      ),
    },
    { key: "topic", header: "Topic", cell: (q) => q.topic_name },
    {
      key: "type",
      header: "Type",
      cell: (q) => <span className="whitespace-nowrap">{`${q.type.toUpperCase()} · ${q.marks}m`}</span>,
    },
    {
      key: "text",
      header: "Question",
      cell: (q) => (
        <span className="block max-w-[360px] truncate">
          <Rich text={previewText(q.stem, 80)} />
        </span>
      ),
    },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (q) => {
        const i = s.questions.indexOf(q);
        const practice = q.pool === "practice";
        return confirm === `q:${s.id}:${q.id}` ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Text as="span">{practice ? "Take it out of this mock?" : "Delete?"}</Text>
            <Button size="sm" variant="danger" loading={removeItem.pending} onClick={() => delItem(s, q)}>
              Yes
            </Button>
            <Button size="sm" variant="soft" onClick={() => setConfirm(null)}>
              No
            </Button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <IconButton
              size="sm"
              label={`Move ${q.id} up`}
              disabled={i === 0}
              onClick={() => void moveItem.run({ sectionId: s.id, questionId: q.id, dir: -1 })}
            >
              <IconChevronDown className="rotate-180" />
            </IconButton>
            <IconButton
              size="sm"
              label={`Move ${q.id} down`}
              disabled={i === s.questions.length - 1}
              onClick={() => void moveItem.run({ sectionId: s.id, questionId: q.id, dir: 1 })}
            >
              <IconChevronDown />
            </IconButton>
            <Button size="sm" variant="soft" onClick={() => setEdit({ id: q.id })}>
              Edit
            </Button>
            <Button size="sm" variant="soft" onClick={() => setConfirm(`q:${s.id}:${q.id}`)}>
              {practice ? "Remove" : "Delete"}
            </Button>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {back}
        <Button variant="danger" className="ml-auto" icon={<IconTrash />} onClick={() => setAsking(true)}>
          Delete mock test
        </Button>
      </div>
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title={`Delete "${mock.name}"?`}
        footer={
          <>
            <Button variant="soft" onClick={() => setAsking(false)}>
              Keep it
            </Button>
            <Button variant="danger" icon={<IconTrash />} loading={removeMock.pending} onClick={delMock}>
              Delete mock test
            </Button>
          </>
        }
      >
        <Text>
          {`It deletes this mock test and its ${plural(own, "mock-only question")}.${practiceUsed ? ` The ${plural(practiceUsed, "practice question")} it uses stay in Practice.` : ""} Your past results on it stay in your stats.`}
        </Text>
      </Dialog>
      <Heading level={2} className="mt-3.5">
        {mock.name}
      </Heading>
      <Text variant="muted" className="mt-1">
        {`\`${mock.id}\` · ${plural(data.questions, "question")}, ${data.marks} marks, ${mock.minutes} minutes.`}
      </Text>

      <DetailsCard key={JSON.stringify([mock.name, mock.minutes, mock.full_screen, mock.instructions])} mock={mock} />

      <Heading level={2} className="mt-6">
        Sections
      </Heading>
      <Text variant="muted" className="mt-1">
        Questions run in the order shown here. Each one has its own id, unique across all banks.
      </Text>
      {msg && (
        <div role="alert" className="mt-2">
          <Text variant="error">{msg}</Text>
        </div>
      )}

      {sections.map((s, si) => (
        <Card key={s.id} className="my-3.5">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <TextField
              key={s.name}
              className="min-w-[140px] flex-[1_1_200px]"
              aria-label="Section name"
              defaultValue={s.name}
              onBlur={async (e) => {
                const v = e.target.value;
                if (v.trim() === s.name) return void (e.target.value = s.name);
                const r = await rename.run({ id: s.id, name: v });
                if (r && !r.ok) {
                  e.target.value = s.name;
                  setMsg(r.error);
                } else setMsg("");
              }}
            />
            <IconButton
              label="Move section up"
              disabled={si === 0}
              onClick={() => void moveSection.run({ id: s.id, dir: -1 })}
            >
              <IconChevronDown className="rotate-180" />
            </IconButton>
            <IconButton
              label="Move section down"
              disabled={si === sections.length - 1}
              onClick={() => void moveSection.run({ id: s.id, dir: 1 })}
            >
              <IconChevronDown />
            </IconButton>
            <Button
              variant="primary"
              icon={<IconPlus />}
              disabled={overview.topics.length === 0}
              onClick={() => setEdit({ id: null, sectionId: s.id })}
            >
              Add question
            </Button>
            {confirm === `s:${s.id}` ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <Text as="span" variant="small">
                  {`Delete the section and its ${plural(s.questions.length, "question")}?`}
                </Text>
                <Button variant="danger" size="sm" loading={removeSection.pending} onClick={() => delSection(s)}>
                  Yes
                </Button>
                <Button variant="soft" size="sm" onClick={() => setConfirm(null)}>
                  No
                </Button>
              </span>
            ) : (
              <Button variant="soft" onClick={() => setConfirm(`s:${s.id}`)}>
                Delete section
              </Button>
            )}
          </div>
          <Table
            columns={columns(s)}
            rows={s.questions}
            rowKey={(q) => q.id}
            empty="No questions in this section yet."
          />
        </Card>
      ))}
      {sections.length === 0 && (
        <Text variant="muted" className="my-3.5">
          This mock has no sections yet. Add one to start adding questions.
        </Text>
      )}
      {overview.topics.length === 0 && (
        <Text variant="small">Add a topic first (Topics tab). Every question needs one.</Text>
      )}

      <Heading level={3} className="mt-5">
        Add a section
      </Heading>
      <div className="my-2 flex flex-wrap items-center gap-2">
        <TextField
          className="min-w-[140px] flex-[1_1_200px]"
          aria-label="New section name"
          placeholder="Section name, e.g. Part A"
          value={newSec}
          onChange={(e) => setNewSec(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
        />
        <Button variant="primary" loading={addSection.pending} disabled={!newSec.trim()} onClick={add}>
          Add section
        </Button>
      </div>

      {edit && (
        <QuestionEditor
          overview={overview}
          id={edit.id}
          preset={edit.id === null ? { mockId, sectionId: edit.sectionId } : undefined}
          onClose={() => setEdit(null)}
          onSaved={(id) => {
            setEdit(null);
            setMsg("");
            toast(`Saved ${id}.`, "success");
          }}
        />
      )}
    </>
  );
}
