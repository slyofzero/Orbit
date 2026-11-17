"use client";
import { useId, type ReactNode } from "react";
import { cx } from "./cx";
import { txt } from "./txt";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

export function Checkbox({ checked, onChange, label, description, disabled }: CheckboxProps) {
  return (
    <label className={cx("ui-choice", disabled && "is-disabled")}>
      <input type="checkbox" className="ui-check" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <span className="ui-choice-text">
        <span>{txt(label)}</span>
        {description && <span className="ui-choice-desc">{txt(description)}</span>}
      </span>
    </label>
  );
}

export type RadioOption<V extends string> = { value: V; label: ReactNode; description?: ReactNode; disabled?: boolean };

export function RadioGroup<V extends string>({ legend, options, value, onChange, disabled }: {
  legend?: ReactNode;
  options: RadioOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="ui-group" disabled={disabled}>
      {legend && <legend className="ui-label">{txt(legend)}</legend>}
      {options.map((o) => (
        <label key={o.value} className={cx("ui-choice", (disabled || o.disabled) && "is-disabled")}>
          <input type="radio" className="ui-radio" name={name} value={o.value} checked={value === o.value}
            disabled={o.disabled} onChange={() => onChange(o.value)} />
          <span className="ui-choice-text">
            <span>{txt(o.label)}</span>
            {o.description && <span className="ui-choice-desc">{txt(o.description)}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
