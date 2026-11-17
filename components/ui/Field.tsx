"use client";
import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";
import { HelpTip } from "./Tooltip";
import { txt } from "./txt";

type Wrap = { label?: ReactNode; help?: ReactNode; hint?: ReactNode; error?: ReactNode; className?: string };

/** A field label, with an optional "?" help tip after it (outside the <label>, so clicking it doesn't focus the field). */
export function FieldLabel({ htmlFor, label, help }: { htmlFor: string; label?: ReactNode; help?: ReactNode }) {
  if (!label) return null;
  return (
    <span className="ui-label-row">
      <label className="ui-label" htmlFor={htmlFor}>{txt(label)}</label>
      {help && <HelpTip label="What is this?">{help}</HelpTip>}
    </span>
  );
}

/** Label + control + hint/error, wired up for screen readers. */
function FieldWrap({ id, label, help, hint, error, className, children }: Wrap & { id: string; children: ReactNode }) {
  return (
    <div className={cx("ui-field", error ? "has-error" : null, className)}>
      <FieldLabel htmlFor={id} label={label} help={help} />
      {children}
      {error ? <span className="ui-error" id={`${id}-msg`}>{txt(error)}</span>
        : hint ? <span className="ui-hint" id={`${id}-msg`}>{txt(hint)}</span> : null}
    </div>
  );
}

export function TextField({ label, help, hint, error, className, id, ...rest }: Wrap & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap id={fid} label={label} help={help} hint={hint} error={error} className={className}>
      <input {...rest} id={fid} className="ui-input" aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${fid}-msg` : undefined} />
    </FieldWrap>
  );
}

export function TextArea({ label, help, hint, error, className, id, ...rest }: Wrap & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap id={fid} label={label} help={help} hint={hint} error={error} className={className}>
      <textarea {...rest} id={fid} className="ui-textarea" aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${fid}-msg` : undefined} />
    </FieldWrap>
  );
}
