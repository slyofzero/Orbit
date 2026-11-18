"use client";
import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cx } from "@/components/ui/cx";
import { ERROR, FIELD_BOX, HINT, LABEL } from "@/components/ui/styles";
import { HelpTip } from "@/components/ui/Tooltip";
import { txt } from "@/components/ui/txt";

type Wrap = { label?: ReactNode; help?: ReactNode; hint?: ReactNode; error?: ReactNode; className?: string };

/** A field label, with an optional "?" help tip after it (outside the <label>, so clicking it doesn't focus the field). */
export function FieldLabel({ htmlFor, label, help }: { htmlFor: string; label?: ReactNode; help?: ReactNode }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center">
      <label className={LABEL} htmlFor={htmlFor}>
        {txt(label)}
      </label>
      {help && <HelpTip label="What is this?">{help}</HelpTip>}
    </span>
  );
}

/** The hint or error under a field (the error wins), with the id that aria-describedby points at. */
export function FieldMessage({ id, hint, error }: { id: string; hint?: ReactNode; error?: ReactNode }) {
  if (error)
    return (
      <span className={ERROR} id={`${id}-msg`}>
        {txt(error)}
      </span>
    );
  if (hint)
    return (
      <span className={HINT} id={`${id}-msg`}>
        {txt(hint)}
      </span>
    );
  return null;
}

/** Label + control + hint/error, wired up for screen readers. */
function FieldWrap({ id, label, help, hint, error, className, children }: Wrap & { id: string; children: ReactNode }) {
  return (
    <div className={cx("grid gap-1.5", className)}>
      <FieldLabel htmlFor={id} label={label} help={help} />
      {children}
      <FieldMessage id={id} hint={hint} error={error} />
    </div>
  );
}

export function TextField({
  label,
  help,
  hint,
  error,
  className,
  id,
  ...rest
}: Wrap & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap id={fid} label={label} help={help} hint={hint} error={error} className={className}>
      <input
        {...rest}
        id={fid}
        className={FIELD_BOX}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${fid}-msg` : undefined}
      />
    </FieldWrap>
  );
}

export function TextArea({
  label,
  help,
  hint,
  error,
  className,
  id,
  ...rest
}: Wrap & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap id={fid} label={label} help={help} hint={hint} error={error} className={className}>
      <textarea
        {...rest}
        id={fid}
        className={cx(FIELD_BOX, "min-h-24 resize-y leading-normal")}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${fid}-msg` : undefined}
      />
    </FieldWrap>
  );
}
