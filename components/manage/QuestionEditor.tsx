"use client";
// Manage pack → add or edit one question (v1's QuestionEditor). Saving runs the same checks as an import
// (lib/manage.ts checkForm, again in the manage.saveQuestion query), so a broken question can't be saved.
// The id is the system's: a new question gets one when saved, a saved one keeps its own. A saved question keeps
// its type (db/schema.sql). "Copy prompt" hands any AI the question and the rules to fix how it is written
// (lib/prompts/editPrompt.ts). Pictures can't be added here yet (TODO.md).

import { useEffect, useState } from "react";
import { IconPlus, IconX } from "@/components/icons";
import {
  Button,
  Callout,
  Checkbox,
  Code,
  CodeEditor,
  CopyButton,
  Dialog,
  Dropdown,
  IconButton,
  Radio,
  Rich,
  RichEditor,
  Text,
  TextArea,
  TextField,
} from "@/components/ui";
import type { Overview } from "@/components/manage/QuestionsPanel";
import { useMutation, useQuery } from "@/lib/db/client";
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  TYPE_LABEL,
  changeType,
  dropOption,
  emptyForm,
  formOf,
  letter,
  toggleRight,
  type QuestionForm,
} from "@/lib/manage";
import { editPrompt } from "@/lib/prompts/editPrompt";
import { LIMITS, QUESTION_TYPES } from "@/lib/questionFile";
import type { Difficulty, QuestionType, StrMatch } from "@/types/tables";

const CLOSE_MS = 200; // Dialog's fade-out
const NEW_SECTION = "__new__";

/** A preview of rich text under its box (v1's pk-prev). */
function Preview({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="rounded-md bg-sheet-2 px-3.5 py-2.5">
      <Rich block text={text} />
    </div>
  );
}

export function QuestionEditor({
  overview,
  id,
  preset,
  startType,
  onClose,
  onSaved,
}: {
  overview: Overview;
  /** null = a new question */
  id: string | null;
  /** a new question starts in this mock section */
  preset?: { mockId: string; sectionId: number | null };
  /** a new question starts as this type (Programming: code) */
  startType?: QuestionType;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const { data: loaded } = useQuery("manage.question", { id: id ?? "" });
  const save = useMutation("manage.saveQuestion");
  const [form, setForm] = useState<QuestionForm>(() =>
    changeType(emptyForm(overview.topics[0]?.id ?? ""), startType ?? "mcq"),
  );
  const [where, setWhere] = useState(preset ? `mock:${preset.mockId}` : "practice");
  const [section, setSection] = useState(preset?.sectionId != null ? String(preset.sectionId) : "");
  const [newSection, setNewSection] = useState("");
  const [ready, setReady] = useState(id === null);
  const [errors, setErrors] = useState<string[]>([]);

  // an existing question: fill the form once it has loaded
  useEffect(() => {
    if (ready || !loaded) return;
    setForm(formOf(loaded.question, loaded.detail, loaded.tags));
    if (loaded.place && loaded.question.pool === "mock") {
      setWhere(`mock:${loaded.place.mockId}`);
      setSection(String(loaded.place.sectionId));
    }
    setReady(true);
  }, [loaded, ready]);

  const close = () => {
    setOpen(false);
    setTimeout(onClose, CLOSE_MS);
  };
  const set = (patch: Partial<QuestionForm>) => setForm((f) => ({ ...f, ...patch }));
  const mock = where.startsWith("mock:") ? overview.mocks.find((m) => m.id === where.slice(5)) : undefined;
  const sections = mock?.sections ?? [];
  const sectionValue = sections.length === 0 ? NEW_SECTION : section || String(sections[0].id);
  const gone = id !== null && loaded === null;

  const submit = async () => {
    const target = mock
      ? {
          mockId: mock.id,
          sectionId: sectionValue === NEW_SECTION ? null : Number(sectionValue),
          newSection,
        }
      : null;
    const r = await save.run({ id, form, target });
    if (!r) return; // the hook already showed the error
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    setOpen(false);
    setTimeout(() => onSaved(r.id), CLOSE_MS);
  };

  return (
    <Dialog
      size="wide"
      open={open}
      onClose={close}
      title={
        <span className="flex items-center gap-2">
          {id ? (
            <span>
              Edit <Code>{id}</Code>
            </span>
          ) : (
            "Add a question"
          )}
          <CopyButton
            size="sm"
            variant="ghost"
            text={() => editPrompt(form)}
            hint="Copy prompt: the question and exact rules for fixing how it is written, to paste into any AI"
            copiedLabel="Prompt copied. Paste it into any AI."
          />
        </span>
      }
      footer={
        <>
          <Button variant="soft" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.pending} disabled={!ready || gone} onClick={submit}>
            {id ? "Save changes" : "Add question"}
          </Button>
        </>
      }
    >
      {gone ? (
        <Text>This question is gone (it was deleted, maybe in another tab).</Text>
      ) : !ready ? (
        <Text variant="muted">Loading…</Text>
      ) : (
        <div className="grid gap-3">
          <TextField
            label={id ? "Id (fixed)" : "Id (assigned by the system)"}
            value={id ?? "Given when you add it"}
            disabled
            hint={
              id
                ? "Saving changes overrides this question. Its id stays the same."
                : "Every question gets its own unique id automatically."
            }
          />
          <Dropdown
            label="Topic"
            searchable
            value={form.topicId || null}
            onChange={(v) => set({ topicId: v })}
            options={overview.topics.map((t) => ({ value: t.id, label: t.name, group: t.subject_name }))}
          />
          <Dropdown
            label="Bank"
            value={where}
            onChange={(v) => {
              setWhere(v);
              setSection("");
              setNewSection("");
            }}
            options={[
              { value: "practice", label: "Practice" },
              ...overview.mocks.map((m) => ({ value: `mock:${m.id}`, label: `Mock: ${m.name}` })),
            ]}
          />
          {mock && (
            <div className="grid gap-2">
              {sections.length > 0 && (
                <Dropdown
                  label="Section of the mock"
                  value={sectionValue}
                  onChange={(v) => setSection(v)}
                  options={[
                    ...sections.map((s) => ({ value: String(s.id), label: s.name })),
                    { value: NEW_SECTION, label: "New section…" },
                  ]}
                />
              )}
              {sectionValue === NEW_SECTION && (
                <TextField
                  label={sections.length ? undefined : "Section of the mock"}
                  aria-label="New section name"
                  placeholder="Section name, e.g. Part A"
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-[2fr_1fr_1fr] gap-2.5 max-[640px]:grid-cols-1">
            <Dropdown
              label="Type"
              value={form.type}
              onChange={(v: QuestionType) => setForm((f) => changeType(f, v))}
              hint={id ? "A saved question keeps its type." : undefined}
              options={QUESTION_TYPES.map((t) => ({
                value: t,
                label: TYPE_LABEL[t],
                disabled: id !== null && t !== form.type,
              }))}
            />
            <TextField
              label="Marks"
              inputMode="decimal"
              value={form.marks}
              onChange={(e) => set({ marks: e.target.value })}
            />
            <TextField
              label="Negative marks"
              inputMode="decimal"
              value={form.negativeMarks}
              onChange={(e) => set({ negativeMarks: e.target.value })}
              hint="0 = none"
            />
          </div>

          <RichEditor
            label="Question"
            hint="LaTeX between $…$"
            rows={5}
            value={form.text}
            onChange={(v) => set({ text: v })}
          />
          <Preview text={form.text} />

          {form.type === "code" ? (
            <CodeEditor
              label="Starter code (optional)"
              hint="Already in the editor when the question opens."
              showLanguage={false}
              rows={6}
              value={form.starter}
              onChange={(v) => set({ starter: v })}
            />
          ) : form.type === "str" ? (
            <div className="grid gap-2.5">
              <TextArea
                label="Accepted answer(s)"
                hint="One per line; any one is accepted."
                rows={3}
                spellCheck={false}
                placeholder="I,D,B"
                value={form.strAnswers}
                onChange={(e) => set({ strAnswers: e.target.value })}
              />
              <div className="grid grid-cols-2 items-end gap-2.5 max-[640px]:grid-cols-1">
                <Dropdown
                  label="How it is compared"
                  value={form.strMatch}
                  onChange={(v: StrMatch) => set({ strMatch: v })}
                  options={[
                    { value: "exact", label: "Exact text" },
                    { value: "list", label: "Ordered list (comma separated)" },
                    { value: "set", label: "Set, any order (comma separated)" },
                  ]}
                />
                <div className="pb-2.5">
                  <Checkbox checked={form.strCase} onChange={(v) => set({ strCase: v })} label="Case matters" />
                </div>
              </div>
              <Text variant="small">Spaces are ignored and case is ignored (unless it matters).</Text>
            </div>
          ) : form.type === "nat" ? (
            <div className="grid grid-cols-2 gap-2.5 max-[640px]:grid-cols-1">
              <TextField
                label="Right answer (a number)"
                inputMode="decimal"
                value={form.natValue}
                onChange={(e) => set({ natValue: e.target.value })}
              />
              <TextField
                label="Allowed error (±)"
                inputMode="decimal"
                value={form.natTol}
                onChange={(e) => set({ natTol: e.target.value })}
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <Text variant="small">{`Options. Tick the right ${form.type === "mcq" ? "one" : "ones"}.`}</Text>
              {form.options.map((o, i) => (
                <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5">
                  {form.type === "mcq" ? (
                    <span className="flex items-center gap-2">
                      <Radio
                        name="right-option"
                        checked={form.picked.includes(i)}
                        onChange={() => setForm((f) => toggleRight(f, i))}
                        label={`Option ${letter(i)} is right`}
                      />
                      <b className="w-[18px]">{letter(i)}</b>
                    </span>
                  ) : (
                    <span className="w-[46px]">
                      <Checkbox
                        checked={form.picked.includes(i)}
                        onChange={() => setForm((f) => toggleRight(f, i))}
                        label={`**${letter(i)}**`}
                      />
                    </span>
                  )}
                  <TextField
                    aria-label={`Option ${letter(i)}`}
                    spellCheck={false}
                    value={o}
                    onChange={(e) => set({ options: form.options.map((x, k) => (k === i ? e.target.value : x)) })}
                  />
                  {form.options.length > LIMITS.minOptions ? (
                    <IconButton label={`Remove option ${letter(i)}`} onClick={() => setForm((f) => dropOption(f, i))}>
                      <IconX />
                    </IconButton>
                  ) : (
                    <span />
                  )}
                  {/(!\[|\$)/.test(o) && (
                    <div className="col-start-2 rounded-md bg-sheet-2 px-3 py-2 text-[0.95rem]">
                      <Rich text={o} />
                    </div>
                  )}
                </div>
              ))}
              {form.options.length < LIMITS.maxOptions && (
                <div>
                  <Button
                    variant="soft"
                    size="sm"
                    icon={<IconPlus />}
                    onClick={() => set({ options: [...form.options, ""] })}
                  >
                    Add option
                  </Button>
                </div>
              )}
            </div>
          )}

          <RichEditor
            label={form.type === "code" ? "Explanation (the model solution)" : "Explanation"}
            rows={3}
            value={form.explanation}
            onChange={(v) => set({ explanation: v })}
          />
          <Preview text={form.explanation} />
          <Dropdown
            label="Difficulty"
            placeholder="Pick one…"
            value={form.difficulty || null}
            onChange={(v: Difficulty) => set({ difficulty: v })}
            options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }))}
          />
          <TextField
            label="Tags"
            hint={`Optional, at most ${LIMITS.tags}, general skills only like formula or trap, separated by commas.`}
            placeholder="formula, trap"
            value={form.tags}
            onChange={(e) => set({ tags: e.target.value })}
          />

          {errors.length > 0 && (
            <div role="alert">
              <Callout tone="warn" title="🔴 Fix this first:">
                <ul className="m-0 grid gap-1 pl-5">
                  {errors.map((e) => (
                    <li key={e}>
                      <Text as="span">{e}</Text>
                    </li>
                  ))}
                </ul>
              </Callout>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
