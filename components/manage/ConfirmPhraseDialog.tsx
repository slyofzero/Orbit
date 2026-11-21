"use client";
// Manage pack's "type it to confirm" dialog for actions that can't be undone (Delete pack, Empty a bank): a
// CAUTION box saying what goes, a box where the phrase must be typed (shown as a red chip in the label), and a
// danger button that stays off until it matches (lib/manage.ts isPhrase).

import { useState, type ReactNode } from "react";
import { IconTrash } from "@/components/icons";
import { Button, Callout, Dialog, TextField } from "@/components/ui";
import { txt } from "@/components/utils/txt";
import { isPhrase } from "@/lib/manage";

export function ConfirmPhraseDialog({
  open,
  onClose,
  title,
  phrase,
  warning,
  keepLabel,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** what must be typed, lower case, e.g. "delete pack" */
  phrase: string;
  /** what goes and what stays (markdown) */
  warning: string;
  keepLabel: string;
  confirmLabel: string;
  pending: boolean;
  /** runs only once the phrase is typed; the dialog closes when it resolves to true */
  onConfirm: () => Promise<boolean>;
}) {
  const [typed, setTyped] = useState("");
  const ready = isPhrase(typed, phrase);
  const close = () => {
    setTyped("");
    onClose();
  };
  const go = async () => {
    if (ready && (await onConfirm())) close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="soft" onClick={close}>
            {keepLabel}
          </Button>
          <Button variant="danger" icon={<IconTrash />} loading={pending} disabled={!ready} onClick={go}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Callout tone="caution" title="This cannot be undone.">
        {warning}
      </Callout>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void go();
        }}
      >
        <TextField
          autoFocus
          label={
            <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
              {txt("Type")}
              <span className="rounded-[6px] border border-red/40 bg-red-soft px-1.5 font-mono text-red">
                {txt(phrase)}
              </span>
              {txt("to confirm")}
            </span>
          }
          placeholder={phrase}
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </form>
    </Dialog>
  );
}
