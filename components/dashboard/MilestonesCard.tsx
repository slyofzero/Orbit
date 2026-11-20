"use client";
// v1's "Milestones": every date the plan counts down to, the next one highlighted, past ones faded.
// Adding, editing and removing aren't wired yet (useSoon); the form is here so its look is final.

import { useState } from "react";
import { Button, Card, DatePicker, IconButton, Text, TextField } from "@/components/ui";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { PANEL, useSoon } from "@/components/dashboard/kit";
import { cx } from "@/components/utils/cx";
import { useQuery } from "@/lib/db/client";
import { daysBetween, formatLong, type IsoDate } from "@/lib/dates";

const DOTS = ["bg-accent", "bg-red", "bg-green", "bg-amber", "bg-blue"];

type Draft = { id: number | null; name: string; date: IsoDate | null; note: string };

export function MilestonesCard({ today }: { today: IsoDate }) {
  const soon = useSoon();
  const { data } = useQuery("dashboard.milestones");
  const [draft, setDraft] = useState<Draft | null>(null);
  const list = data ?? [];
  const nextId = list.find((m) => m.on_date >= today)?.id;

  return (
    <Card
      className={cx(PANEL, "[&>header>div]:basis-[120px]!")}
      title="Milestones"
      actions={
        !draft && (
          <Button
            variant="soft"
            size="sm"
            icon={<IconPlus />}
            onClick={() => setDraft({ id: null, name: "", date: null, note: "" })}
          >
            Add
          </Button>
        )
      }
    >
      {draft && (
        <form
          className="mb-3 grid gap-3 rounded-[18px] bg-sheet-2 p-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            soon(draft.id === null ? "Adding milestones" : "Editing milestones")();
          }}
        >
          <TextField
            label="Name"
            maxLength={40}
            placeholder="e.g. Viva, Mock series"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <DatePicker label="Date" value={draft.date} onChange={(date) => setDraft({ ...draft, date })} />
          <TextField
            label="Note (optional)"
            maxLength={80}
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary">
              {draft.id === null ? "Add milestone" : "Save changes"}
            </Button>
            <Button variant="soft" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <div className="rounded-[16px] border-[1.5px] border-dashed border-line px-4 py-3.5">
          <Text variant="muted">No milestones yet. Add an exam or deadline and the countdown starts.</Text>
        </div>
      ) : (
        <div className="grid gap-1">
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
                    onClick={() => setDraft({ id: m.id, name: m.name, date: m.on_date, note: m.note ?? "" })}
                  >
                    <IconPencil />
                  </IconButton>
                  <IconButton
                    label={`Remove ${m.name}`}
                    size="sm"
                    variant="ghost"
                    onClick={soon("Removing milestones")}
                  >
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
