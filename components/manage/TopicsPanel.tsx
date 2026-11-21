"use client";
// Manage pack → Topics (v1's TopicsPanel): rename subjects, rename and rate topics, add a topic (to a subject or
// a new one), and delete a topic no question uses. Ids are the system's (db/schema.sql), so a new topic needs
// only its name. Renames save when you leave the box.

import { useState } from "react";
import type { Overview } from "@/components/manage/QuestionsPanel";
import { Button, Code, Dropdown, Heading, Table, Text, TextField, useToast, type Column } from "@/components/ui";
import { useMutation } from "@/lib/db/client";
import { ratingOf } from "@/lib/practice";
import type { TopicRating } from "@/types/tables";

type Topic = Overview["topics"][number];
const STATUS: { value: TopicRating; label: string }[] = [
  { value: "know", label: "I know it" },
  { value: "shaky", label: "Shaky" },
  { value: "no_idea", label: "No idea" },
];
const NEW_SUBJECT = "__new__";

export function TopicsPanel({ overview }: { overview: Overview }) {
  const toast = useToast();
  const renameSubject = useMutation("manage.renameSubject");
  const renameTopic = useMutation("manage.renameTopic");
  const rate = useMutation("manage.rateTopic");
  const removeTopic = useMutation("manage.removeTopic");
  const addTopic = useMutation("manage.addTopic");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState(overview.subjects[0]?.id ?? NEW_SUBJECT);
  const [newSubject, setNewSubject] = useState("");
  const [err, setErr] = useState("");
  const useNew = overview.subjects.length === 0 || subject === NEW_SUBJECT;

  /** A failed rename puts the old name back (the box is keyed by the saved name) and says why. */
  const said = (r: { ok: true } | { ok: false; error: string } | undefined) => {
    if (r && !r.ok) toast(r.error, "error");
  };

  const add = async () => {
    const r = await addTopic.run({ subjectId: useNew ? null : subject, newSubject, name });
    if (!r) return;
    if (!r.ok) return setErr(r.error);
    toast(`Added the topic "${name.trim()}".`, "success");
    setName("");
    setNewSubject("");
    setErr("");
  };

  const columns: Column<Topic>[] = [
    { key: "id", header: "Id", cell: (t) => <Code>{t.id}</Code> },
    { key: "subject", header: "Subject", cell: (t) => t.subject_name },
    {
      key: "name",
      header: "Name",
      cell: (t) => (
        <TextField
          key={t.name}
          aria-label={`Name of ${t.name}`}
          defaultValue={t.name}
          onBlur={async (e) => {
            const v = e.target.value.trim();
            if (!v || v === t.name) return void (e.target.value = t.name);
            const r = await renameTopic.run({ id: t.id, name: v });
            if (r && !r.ok) e.target.value = t.name;
            said(r);
          }}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (t) => (
        <div className="min-w-[140px]">
          <Dropdown
            size="sm"
            value={ratingOf(t.rating)}
            onChange={(v: TopicRating) => void rate.run({ id: t.id, rating: v })}
            options={STATUS}
          />
        </div>
      ),
    },
    { key: "questions", header: "Questions", align: "right", cell: (t) => String(t.questions) },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (t) =>
        t.questions === 0 ? (
          <Button
            size="sm"
            variant="soft"
            loading={removeTopic.pending}
            onClick={async () => said(await removeTopic.run({ id: t.id }))}
          >
            Delete
          </Button>
        ) : (
          <Text as="span" variant="small">
            in use
          </Text>
        ),
    },
  ];

  return (
    <>
      <Heading level={2}>Subjects</Heading>
      <div className="mt-2 mb-3.5 flex flex-wrap gap-2.5">
        {overview.subjects.map((s) => (
          <div key={s.id} className="grid gap-1">
            <Code>{s.id}</Code>
            <TextField
              key={s.name}
              aria-label={`Name of the subject ${s.name}`}
              defaultValue={s.name}
              onBlur={async (e) => {
                const v = e.target.value.trim();
                if (!v || v === s.name) return void (e.target.value = s.name);
                const r = await renameSubject.run({ id: s.id, name: v });
                if (r && !r.ok) e.target.value = s.name;
                said(r);
              }}
            />
          </div>
        ))}
      </div>

      <Heading level={2} className="mb-2">
        Topics
      </Heading>
      <Table columns={columns} rows={overview.topics} rowKey={(t) => t.id} empty="No topics yet." />

      <Heading level={3} className="mt-5">
        Add a topic
      </Heading>
      <div className="my-2 flex flex-wrap items-center gap-2">
        <TextField
          className="min-w-[140px] flex-[1_1_200px]"
          aria-label="Topic name"
          placeholder="Name, e.g. Algebra"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
        />
        <div className="w-[220px]">
          <Dropdown
            value={useNew ? NEW_SUBJECT : subject}
            onChange={setSubject}
            options={[
              ...overview.subjects.map((s) => ({ value: s.id, label: s.name })),
              { value: NEW_SUBJECT, label: "New subject…" },
            ]}
          />
        </div>
        {useNew && (
          <TextField
            className="min-w-[140px] flex-[1_1_200px]"
            aria-label="New subject name"
            placeholder="New subject name"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
          />
        )}
        <Button variant="primary" loading={addTopic.pending} onClick={add}>
          Add topic
        </Button>
      </div>
      {err && (
        <Text variant="error" className="my-2">
          {err}
        </Text>
      )}
      <Text variant="small">A topic can only be deleted when no question uses it.</Text>
    </>
  );
}
