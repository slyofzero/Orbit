"use client";
// Edit plan (/planner/edit, v1's PlanEdit): the plan's name and description, Add a day, and every day of the plan
// in a list (the latest past days first, more on request, then today onwards). Opening a day shows its editor:
// title, type, hours, note, tasks (edit, add, remove: a tick stays with its task) and linked questions (find and
// add, remove, copy all, paste links copied from another day). Locked days (past, or today after the lock hour)
// are shown but can't be changed. Queries: lib/db/queries/planEdit.ts; the day rules: lib/planEdit.ts.

import { useEffect, useState } from "react";
import { KIND_LABEL, KIND_PILL } from "@/components/dashboard/kit";
import { IconChevronLeft, IconPlus, IconTrash, IconX } from "@/components/icons";
import { pageNav, type Clock } from "@/components/planner/PlanActions";
import {
  Button,
  Callout,
  Card,
  Code,
  CopyButton,
  DatePicker,
  Disclosure,
  Divider,
  Dropdown,
  EmptyState,
  Heading,
  IconButton,
  Pill,
  Rich,
  Spinner,
  Text,
  TextArea,
  TextField,
  useToast,
} from "@/components/ui";
import { dbCall, useMutation, useQuery } from "@/lib/db/client";
import type { ResultOf } from "@/lib/db/queries";
import { LOCK_HOUR, dayLock } from "@/lib/dashboard";
import { formatDate, istHour, todayIST, type IsoDate } from "@/lib/dates";
import { previewText } from "@/lib/manage";
import { checkDay, idsFromText, type DayForm } from "@/lib/planEdit";
import { DAY_KINDS, LIMITS } from "@/lib/planFile";

type Day = NonNullable<ResultOf<"plan.editDays">>["days"][number];
type Hit = { stem: string | null; topic: string | null };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const PAST_FIRST = 2; // past days listed at first (v1): the latest two, then PAST_MORE more per click
const PAST_MORE = 5;
/** Going deeper from Manage plan: the page slides in from the right (styles/animations/page-slide.css). */
const SLIDE_IN = "motion-safe:animate-page-from-right";
let copiedLinks: string[] = []; // the last copied set, kept here in case the clipboard can't be read back

/** Reads the clock only in the browser, so the server and the first render agree. */
export function EditPlan() {
  const [clock, setClock] = useState<Clock | null>(null);
  useEffect(() => setClock({ today: todayIST(), hour: istHour() }), []);
  // leaving (Back to Manage plan, or the browser's back): Manage plan then slides in from the left
  useEffect(
    () => () => {
      pageNav.leftEdit = true;
    },
    [],
  );
  return clock ? <Editor clock={clock} /> : null;
}

function Editor({ clock }: { clock: Clock }) {
  const toast = useToast();
  const { data } = useQuery("plan.editDays");
  const addDay = useMutation("plan.addDay");
  const [open, setOpen] = useState<number | null>(null);
  const [newDate, setNewDate] = useState<IsoDate | null>(null);
  const [addError, setAddError] = useState("");
  const [pastShown, setPastShown] = useState(PAST_FIRST);

  const header = (
    <div className="mb-[18px] flex flex-wrap items-center gap-3">
      <Heading level={1}>Edit plan</Heading>
      <div className="ml-auto">
        <Button variant="secondary" href="/planner/manage" icon={<IconChevronLeft />}>
          Back to Manage plan
        </Button>
      </div>
    </div>
  );
  if (data === undefined) return null; // the page slides in once it has something to show
  if (data === null)
    return (
      <div className={SLIDE_IN}>
        {header}
        <EmptyState icon="🗓️" title="There is no plan to edit yet.">
          Upload a plan from Manage plan first.
        </EmptyState>
      </div>
    );

  const { plan, days } = data;
  const past = days.filter((d) => d.on_date < clock.today);
  const rest = days.filter((d) => d.on_date >= clock.today);
  const add = async () => {
    if (!newDate) return setAddError("Pick a date first.");
    const r = await addDay.run({ date: newDate });
    if (!r) return;
    if (!r.ok) return setAddError(r.error);
    setAddError("");
    setNewDate(null);
    setOpen(r.dayId);
    toast(`Added **${formatDate(newDate)}**. It is open below: give it a title and its tasks.`, "success");
  };
  const row = (d: Day) => (
    <DayRow
      key={d.id}
      day={d}
      clock={clock}
      open={open === d.id}
      onOpen={(o) => setOpen(o ? d.id : null)}
      onDeleted={() => setOpen(null)}
    />
  );

  return (
    <div className={SLIDE_IN}>
      {header}
      <Text variant="muted">
        {`Open a day to change its title, type, hours, tasks or linked questions. A tick stays with its task when you edit, reorder or add tasks. Past days, and today after ${LOCK_HOUR} AM, are locked.`}
      </Text>

      <div className="mt-4 mb-6 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
        <PlanDetails name={plan.name} description={plan.description} />
        <Card title="Add a day">
          <div className="grid gap-3">
            <Text variant="small">{`Any free date from ${formatDate(plan.starts_on)} to ${formatDate(plan.ends_on)}.`}</Text>
            <DatePicker
              label="Date"
              value={newDate}
              onChange={(v) => {
                setNewDate(v);
                setAddError("");
              }}
              min={plan.starts_on}
              max={plan.ends_on}
              error={addError || undefined}
            />
            <div>
              <Button variant="soft" icon={<IconPlus />} loading={addDay.pending} onClick={add}>
                Add a day
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-2">
        {past.length > 0 && (
          <>
            <Text variant="small">{`Past days (${Math.min(pastShown, past.length)} of ${past.length})`}</Text>
            {past.length > pastShown && (
              <div>
                <Button variant="ghost" size="sm" onClick={() => setPastShown((n) => n + PAST_MORE)}>
                  {`Show ${plural(Math.min(PAST_MORE, past.length - pastShown), "earlier day")}`}
                </Button>
              </div>
            )}
            {past.slice(-pastShown).map(row)}
            <Divider label="Today onwards" />
          </>
        )}
        {rest.length ? rest.map(row) : <Text variant="muted">No days left from today on.</Text>}
      </div>
    </div>
  );
}

function PlanDetails({ name, description }: { name: string; description: string | null }) {
  const toast = useToast();
  const save = useMutation("plan.saveDetails");
  const [n, setN] = useState(name);
  const [d, setD] = useState(description ?? "");
  const [error, setError] = useState("");
  const changed = n !== name || d !== (description ?? "");
  return (
    <Card title="The plan">
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await save.run({ name: n, description: d });
          if (!r) return;
          if (!r.ok) return setError(r.error);
          setError("");
          toast("Saved the plan's name and description.", "success");
        }}
      >
        <TextField
          label="Name"
          value={n}
          maxLength={LIMITS.name}
          onChange={(e) => setN(e.target.value)}
          error={error || undefined}
        />
        <TextArea
          label="Description"
          hint="What the plan is for, in your own words. **Link questions** hands it to the AI."
          value={d}
          rows={3}
          maxLength={LIMITS.description}
          onChange={(e) => setD(e.target.value)}
        />
        <div>
          <Button variant="primary" type="submit" disabled={!changed || !n.trim()} loading={save.pending}>
            Save details
          </Button>
        </div>
      </form>
    </Card>
  );
}

function DayRow({
  day,
  clock,
  open,
  onOpen,
  onDeleted,
}: {
  day: Day;
  clock: Clock;
  open: boolean;
  onOpen: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const locked = dayLock(day.on_date, clock.today, clock.hour) === "locked";
  // the editor mounts on the first open and then stays, so the row can animate shut and keeps an unsaved draft
  const [seen, setSeen] = useState(open);
  if (open && !seen) setSeen(true);
  const title = (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
      <span className={day.on_date === clock.today ? "font-bold text-accent" : "font-bold"}>
        {formatDate(day.on_date)}
      </span>
      <span className="min-w-0 truncate">
        <Rich text={day.title ?? KIND_LABEL[day.kind]} />
      </span>
      <Pill tone={KIND_PILL[day.kind]}>{KIND_LABEL[day.kind]}</Pill>
      <Text as="span" variant="small">
        {`${plural(day.tasks, "task")} · ${plural(day.questions, "question")}${locked ? " · 🔒 locked" : ""}`}
      </Text>
    </span>
  );
  return (
    <Disclosure title={title} open={open} onOpenChange={onOpen} className="rounded-lg border border-line bg-sheet">
      {seen && <DayEditor dayId={day.id} date={day.on_date} locked={locked} clock={clock} onDeleted={onDeleted} />}
    </Disclosure>
  );
}

function DayEditor({
  dayId,
  date,
  locked,
  clock,
  onDeleted,
}: {
  dayId: number;
  date: IsoDate;
  locked: boolean;
  clock: Clock;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const { data } = useQuery("plan.editDay", { dayId });
  const save = useMutation("plan.saveDay");
  const del = useMutation("plan.deleteDay");
  const [form, setForm] = useState<DayForm | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set()); // ticked task ids
  const [known, setKnown] = useState<Map<string, Hit>>(new Map()); // what each linked id shows
  const [find, setFind] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [askDelete, setAskDelete] = useState(false);
  const { data: hits } = useQuery("plan.findQuestions", { search: find });

  // fill the form from the saved day: when it first loads, and again after a save (form reset to null)
  useEffect(() => {
    if (!data || form) return;
    setForm({
      title: data.day.title ?? "",
      kind: data.day.kind,
      hours: data.day.hours === null ? "" : String(data.day.hours),
      note: data.day.note ?? "",
      tasks: data.tasks.map((t) => ({ id: t.id, body: t.body })),
      questions: data.questions.map((q) => q.id),
    });
    setDone(new Set(data.tasks.filter((t) => t.done).map((t) => t.id)));
    setKnown(new Map(data.questions.map((q) => [q.id, { stem: q.stem, topic: q.topic }])));
  }, [data, form]);

  if (!data || !form) return <Spinner label="Opening the day" />;
  const set = (patch: Partial<DayForm>) => setForm({ ...form, ...patch });
  const setTask = (i: number, body: string) => set({ tasks: form.tasks.map((t, j) => (j === i ? { ...t, body } : t)) });
  const learn = (rows: { id: string; stem: string | null; topic: string | null }[]) =>
    setKnown((m) => new Map([...m, ...rows.map((r) => [r.id, { stem: r.stem, topic: r.topic }] as const)]));

  const copyLinks = () => {
    copiedLinks = form.questions;
    toast(`Copied ${plural(form.questions.length, "linked question")}. Open another day and press **Paste links**.`);
  };
  const pasteLinks = async () => {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      /* reading the clipboard was blocked: use the in-app copy below */
    }
    let ids = idsFromText(text);
    let found = ids.length ? await dbCall("plan.findQuestions", { search: "", ids }) : [];
    if (!found.length && copiedLinks.length) {
      ids = copiedLinks;
      found = await dbCall("plan.findQuestions", { search: "", ids });
    }
    const fresh = found.filter((h) => !form.questions.includes(h.id));
    if (!fresh.length)
      return toast(
        ids.length
          ? "Those questions are linked here already, or aren't practice questions in your bank."
          : "Nothing to paste. Press **Copy all links** on another day first.",
        "error",
      );
    learn(fresh);
    set({ questions: [...form.questions, ...fresh.map((h) => h.id)] });
    toast(
      `Pasted ${plural(fresh.length, "link")}${ids.length > found.length ? `, skipped ${ids.length - found.length} not in your bank` : ""}. Press **Save this day** to keep them.`,
    );
  };

  const saveDay = async () => {
    const c = checkDay(form);
    if (!c.day) return setErrors(c.errors);
    const r = await save.run({ ...clock, dayId, form });
    if (!r) return;
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    setForm(null); // reload from what was saved (new tasks get their ids)
    toast(
      `Saved **${formatDate(date)}**: ${plural(r.tasks, "task")}, ${plural(r.questions, "linked question")}.${r.dropped ? ` ${plural(r.dropped, "question")} left out: not in your practice bank.` : ""}`,
      "success",
    );
  };
  const deleteDay = async () => {
    const r = await del.run({ ...clock, dayId });
    if (!r) return;
    if (!r.ok) return toast(r.error, "error");
    toast(`Deleted **${formatDate(date)}**.`, "success");
    onDeleted();
  };

  const search = (hits ?? []).filter((h) => !form.questions.includes(h.id));
  return (
    <div className="grid gap-4 pt-2 pb-1">
      {locked && (
        <Callout tone="caution" title="🔒 Locked">
          <Text>
            {date === clock.today
              ? `Today is locked after ${LOCK_HOUR} AM, so its tasks and linked questions can't be changed. You can still tick tasks and solve questions.`
              : "This day is over, so it can't be changed any more. You can still tick its tasks on the Planner."}
          </Text>
          {/* outside the disabled fieldset, so a locked day's links can still be copied to another day (v1) */}
          {form.questions.length > 0 && (
            <div className="mt-2.5">
              <CopyButton
                size="sm"
                text={() => form.questions.join("\n")}
                label="Copy this day's links"
                copiedLabel="Copied"
                onCopied={copyLinks}
              />
            </div>
          )}
        </Callout>
      )}
      <fieldset disabled={locked} className="m-0 grid min-w-0 gap-4 border-0 p-0">
        <TextField
          label="Title"
          value={form.title}
          maxLength={LIMITS.title}
          onChange={(e) => set({ title: e.target.value })}
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          <Dropdown
            label="Type"
            value={form.kind}
            onChange={(k) => set({ kind: k })}
            options={DAY_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          />
          <TextField
            label="Hours"
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={form.hours}
            onChange={(e) => set({ hours: e.target.value })}
            placeholder="Not set"
          />
        </div>
        <TextArea
          label="Note"
          value={form.note}
          rows={2}
          maxLength={LIMITS.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder="Optional: anything to remember about this day"
        />

        <div className="grid gap-2">
          <Text className="font-bold">{`Tasks (${form.tasks.length})`}</Text>
          {form.tasks.map((t, i) => (
            <div key={t.id ?? `new-${i}`} className="flex items-start gap-2">
              <TextField
                className="min-w-0 flex-1"
                aria-label={`Task ${i + 1}`}
                value={t.body}
                maxLength={LIMITS.task}
                onChange={(e) => setTask(i, e.target.value)}
              />
              {t.id !== null && done.has(t.id) && (
                <span className="pt-2">
                  <Pill tone="green">ticked</Pill>
                </span>
              )}
              <IconButton
                label={`Remove task ${i + 1}`}
                onClick={() => set({ tasks: form.tasks.filter((_, j) => j !== i) })}
              >
                <IconTrash />
              </IconButton>
            </div>
          ))}
          <div>
            <Button
              variant="soft"
              size="sm"
              icon={<IconPlus />}
              disabled={form.tasks.length >= LIMITS.tasks}
              onClick={() => set({ tasks: [...form.tasks, { id: null, body: "" }] })}
            >
              Add a task
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Text className="font-bold">{`Linked questions (${form.questions.length})`}</Text>
            {!locked && (
              <div className="ml-auto flex flex-wrap gap-2">
                {form.questions.length > 0 && (
                  <CopyButton
                    size="sm"
                    text={() => form.questions.join("\n")}
                    label="Copy all links"
                    copiedLabel="Copied"
                    onCopied={copyLinks}
                  />
                )}
                <Button variant="soft" size="sm" onClick={pasteLinks}>
                  Paste links
                </Button>
                <Button
                  variant="soft"
                  size="sm"
                  disabled={!form.questions.length}
                  onClick={() => set({ questions: [] })}
                >
                  Remove all
                </Button>
              </div>
            )}
          </div>
          {form.questions.length === 0 && (
            <Text variant="muted">
              No questions linked to this day yet. Find some below, use **Link questions** on Manage plan, or paste
              links copied from another day.
            </Text>
          )}
          {form.questions.map((id) => {
            const q = known.get(id);
            return (
              <div key={id} className="flex items-start gap-2.5 rounded-md border border-line-2 px-3 py-2">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span>
                    <Code>{id}</Code>
                  </span>
                  <Text as="span" variant="small">
                    {q?.stem
                      ? `${q.topic ? `${q.topic}: ` : ""}${previewText(q.stem, 110)}`
                      : "No longer in your question bank"}
                  </Text>
                </div>
                <IconButton
                  label={`Unlink ${id}`}
                  size="sm"
                  onClick={() => set({ questions: form.questions.filter((x) => x !== id) })}
                >
                  <IconX />
                </IconButton>
              </div>
            );
          })}
          {!locked && (
            <>
              <TextField
                aria-label="Find a question to add"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                placeholder="Find a question to add: type part of its id, topic or text"
              />
              {find.trim() &&
                (search.length === 0 ? (
                  <Text variant="small">No match in your practice questions.</Text>
                ) : (
                  search.map((h) => (
                    <div key={h.id} className="flex items-center gap-2.5 px-1">
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <span>
                          <Code>{h.id}</Code>
                        </span>
                        <Text as="span" variant="small">{`${h.topic}: ${previewText(h.stem, 110)}`}</Text>
                      </div>
                      <Button
                        variant="soft"
                        size="sm"
                        disabled={form.questions.length >= LIMITS.questions}
                        onClick={() => {
                          learn([h]);
                          set({ questions: [...form.questions, h.id] });
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  ))
                ))}
            </>
          )}
        </div>
      </fieldset>

      {errors.length > 0 && (
        <Callout tone="caution" title="🔴 Fix this first">
          <ul className="m-0 grid gap-1 pl-5">
            {errors.map((e) => (
              <li key={e}>
                <Text as="span">{e}</Text>
              </li>
            ))}
          </ul>
        </Callout>
      )}
      {!locked &&
        (askDelete ? (
          <div className="grid gap-2.5">
            <Callout tone="caution" title="this can't be undone">
              <Text>
                This deletes the day with its tasks, ticks and linked questions. Your answers are kept. It can&apos;t be
                undone.
              </Text>
            </Callout>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" icon={<IconTrash />} loading={del.pending} onClick={deleteDay}>
                Yes, delete the day
              </Button>
              <Button variant="soft" onClick={() => setAskDelete(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" loading={save.pending} onClick={saveDay}>
              Save this day
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Undo changes
            </Button>
            <Button variant="danger" className="ml-auto" icon={<IconTrash />} onClick={() => setAskDelete(true)}>
              Delete this day
            </Button>
          </div>
        ))}
    </div>
  );
}
