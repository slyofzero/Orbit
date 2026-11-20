"use client";
import { useId, type ReactNode } from "react";
import { cx } from "@/components/utils/cx";
import { LABEL } from "@/components/utils/styles";
import { txt } from "@/components/utils/txt";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

const ROW = "flex items-start gap-2.5";
const BOX =
  "mt-0.5 grid size-5 shrink-0 cursor-[inherit] appearance-none place-items-center border-2 border-gray bg-sheet transition-[background-color,border-color] duration-[120ms] enabled:hover:border-ink checked:after:content-['']";
const CHECK = cx(
  BOX,
  "rounded-[6px] checked:border-accent checked:bg-accent checked:after:h-2.5 checked:after:w-[5px] checked:after:-translate-y-px checked:after:rotate-45 checked:after:border-r-[2.5px] checked:after:border-b-[2.5px] checked:after:border-on-accent",
);
const RADIO = cx(
  BOX,
  "rounded-full checked:border-accent checked:after:size-2.5 checked:after:rounded-full checked:after:bg-accent",
);

function ChoiceText({ label, description }: { label: ReactNode; description?: ReactNode }) {
  return (
    <span className="grid gap-0.5">
      <span>{txt(label)}</span>
      {description && <span className="text-[0.85rem] text-gray">{txt(description)}</span>}
    </span>
  );
}

export function Checkbox({ checked, onChange, label, description, disabled }: CheckboxProps) {
  return (
    <label className={cx(ROW, disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
      <input
        type="checkbox"
        className={CHECK}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <ChoiceText label={label} description={description} />
    </label>
  );
}

export type RadioOption<V extends string> = { value: V; label: ReactNode; description?: ReactNode; disabled?: boolean };

export function RadioGroup<V extends string>({
  legend,
  options,
  value,
  onChange,
  disabled,
}: {
  legend?: ReactNode;
  options: RadioOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="m-0 grid gap-2.5 border-0 p-0" disabled={disabled}>
      {legend && <legend className={cx(LABEL, "mb-2 p-0")}>{txt(legend)}</legend>}
      {options.map((o) => (
        <label
          key={o.value}
          className={cx(ROW, disabled || o.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}
        >
          <input
            type="radio"
            className={RADIO}
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={o.disabled}
            onChange={() => onChange(o.value)}
          />
          <ChoiceText label={o.label} description={o.description} />
        </label>
      ))}
    </fieldset>
  );
}
