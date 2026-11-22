"use client";
// v1's "Milestones": every date the plan counts down to, the next one highlighted, past ones faded.
// Add and Edit open a dialog (not an inline form). Add, edit and remove save at once (milestone.* queries); each shows a toast with Undo, which puts the
// milestone back exactly as it was (docs/PLANS.md §5d).

import { useState } from "react";
import { Button, Card, DatePicker, Dialog, IconButton, Text, TextField, useToast } from "@/components/ui";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { PANEL } from "@/components/dashboard/kit";
import { cx } from "@/components/utils/cx";
import { useMutation, useQuery } from "@/lib/db/client";
import { daysBetween, formatLong, type IsoDate } from "@/lib/dates";
import { checkMilestone, type MilestoneData } from "@/lib/milestones";
import { LIMITS } from "@/lib/planFile";

const DOTS = ["bg-accent", "bg-red", "bg-green", "bg-amber", "bg-blue"];

type Draft = { id: number | null; name: string; date: IsoDate | null; note: string };

export function MilestonesCard({ today }: { today: IsoDate }) {
  const toast = useToast();
  const { data } = useQuery("dashboard.milestones");
  const add = useMutation("milestone.add");
  const edit = useMutation("milestone.edit");
  const { run: remove } = useMutation("milestone.remove");
  const { run: undo } = useMutation("milestone.undo");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const list = data ?? [];
  const nextId = list.find((m) => m.on_date >= today)?.id;

  const [shown, setShown] = useState(false);

  const open = (d: Draft) => {
    setErrors([]);
    setDraft(d);
    setShown(true);
  };

  /** "Undo" on a toast: removes `drop` (an added id) and puts `rows` back. */
  const undoAction = (drop: number | undefined, rows: MilestoneData[]) => ({
    label: "Undo",
    onClick: async () => {
      const r = await undo({ drop, rows });
      if (r && !r.ok) toast(`Couldn't undo: ${r.errors.join(" ")}`, "error");
    },
  });

  const save = async () => {
    if (!draft) return;
    const form = { name: draft.name, date: draft.date, note: draft.note };
    const c = checkMilestone(form);
    if (!c.milestone) return setErrors(c.errors);
    if (draft.id === null) {
      const r = await add.run({ form });
      if (!r) return; // the hook already showed the error
      if (!r.ok) return setErrors(r.errors);
      toast(`Added **${c.milestone.name}**.`, "success", undoAction(r.id, []));
    } else {
      const r = await edit.run({ id: draft.id, form });
      if (!r) return;
      if (!r.ok) return setErrors(r.errors);
      toast(`Saved **${c.milestone.name}**.`, "success", undoAction(undefined, [r.before]));
    }
    setShown(false);
  };

  const drop = async (m: MilestoneData) => {
    const before = await remove({ id: m.id });
    if (before) toast(`Removed **${before.name}**.`, "neutral", undoAction(undefined, [before]));
    if (shown && draft?.id === m.id) setShown(false);
  };

  return (
    <Card
      className={cx(PANEL, "[&>header>div]:basis-[120px]!")}
      title="Milestones"
      actions={
        <Button
          variant="soft"
          size="sm"
          icon={<IconPlus />}
          onClick={() => open({ id: null, name: "", date: null, note: "" })}
        >
          Add
        </Button>
      }
    >
      {/* the draft stays while the dialog slides shut, so its content doesn't blank out */}
      <Dialog
        open={shown}
        onClose={() => setShown(false)}
        title={draft?.id === null ? "Add a milestone" : "Edit milestone"}
        footer={
          <>
            <Button variant="soft" onClick={() => setShown(false)}>
              Cancel
            </Button>
            <Button type="submit" form="milestone-form" variant="primary" loading={add.pending || edit.pending}>
              {draft?.id === null ? "Add milestone" : "Save changes"}
            </Button>
          </>
        }
      >
        {draft && (
          <form
            id="milestone-form"
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <TextField
              label="Name"
              maxLength={LIMITS.milestoneName}
              placeholder="e.g. Viva, Mock series"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <DatePicker label="Date" value={draft.date} onChange={(date) => setDraft({ ...draft, date })} />
            <TextField
              label="Note (optional)"
              maxLength={LIMITS.milestoneNote}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
            {errors.map((e) => (
              <Text key={e} variant="error">
                {e}
              </Text>
            ))}
          </form>
        )}
      </Dialog>

      {list.length === 0 ? (
        <div className="rounded-[16px] border-[1.5px] border-dashed border-line px-4 py-3.5">
          <Text variant="muted">No milestones yet. Add an exam or deadline and the countdown starts.</Text>
        </div>
      ) : (
        <div className="grid max-h-[420px] gap-1 overflow-y-auto">
          {list.map((m, i) => {
            const days = daysBetween(today, m.on_date);
            return (
              <div
                key={m.id}
                className={cx(
                  "group grid grid-cols-[1fr_auto_auto] items-center gap-x-3 rounded-[16px] px-2.5 py-3 transition-colors duration-200",
                  m.id === nextId ? "bg-hi-soft" : "hover:bg-sheet-2",
                  days < 0 && "opacity-50",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cx("size-2.5 shrink-0 rounded-full", DOTS[i % DOTS.length])} />
                  <Text as="span" className="truncate font-display text-[1.12rem] font-bold">
                    {m.name}
                  </Text>
                </div>
                <span className="flex items-baseline gap-1 justify-self-end">
                  {days < 0 ? (
                    <Text as="span" className="font-display text-[1.5rem] font-extrabold">
                      done
                    </Text>
                  ) : (
                    <>
                      <Text as="span" className="font-display text-[1.5rem] font-extrabold tabular-nums">
                        {String(days)}
                      </Text>
                      <Text as="span" variant="hint">
                        {days === 1 ? "day" : "days"}
                      </Text>
                    </>
                  )}
                </span>
                <span className="flex gap-1 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                  <IconButton
                    label={`Edit ${m.name}`}
                    size="sm"
                    variant="ghost"
                    onClick={() => open({ id: m.id, name: m.name, date: m.on_date, note: m.note ?? "" })}
                  >
                    <IconPencil />
                  </IconButton>
                  <IconButton label={`Remove ${m.name}`} size="sm" variant="ghost" onClick={() => void drop(m)}>
                    <IconTrash />
                  </IconButton>
                </span>
                <Text variant="hint" className="col-span-3 mt-0.5">
                  {`${formatLong(m.on_date)}.${m.note ? ` ${m.note}` : ""}`}
                </Text>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
