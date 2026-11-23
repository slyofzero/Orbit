"use client";
import { useId, type ReactNode } from "react";
import { burstFrom } from "@/components/utils/burst";
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
  "mt-0.5 grid size-5 shrink-0 cursor-[inherit] appearance-none place-items-center border-2 border-gray bg-sheet/70 transition-[background-color,border-color] duration-[120ms] enabled:hover:border-ink checked:after:content-['']";
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

// v1's task tick: a round accent ring that pops into a green ✓; the text is struck through once done.
const TASK_ROW =
  "flex items-start gap-3 border-b border-dashed border-line py-2 transition-transform duration-200 hover:translate-x-[3px]";
const TASK_BOX =
  "peer mt-[3px] grid size-[22px] shrink-0 cursor-[inherit] appearance-none place-items-center rounded-full border-2 border-accent bg-sheet/70 transition-[transform,background-color,border-color] duration-[250ms] ease-[cubic-bezier(0.3,1.8,0.5,1)] checked:scale-[1.12] checked:border-green checked:bg-green checked:after:text-[0.85rem] checked:after:leading-none checked:after:font-extrabold checked:after:text-white checked:after:content-['✓']";
const TASK_TEXT = "transition-colors duration-200 peer-checked:text-gray/70 peer-checked:line-through";

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  variant = "default",
  burst: pieces,
}: CheckboxProps & {
  /** task = v1's agenda row: round tick turning green, struck-through text, dashed line under it. */
  variant?: "default" | "task";
  /** task only: throw this many confetti pieces when it gets ticked (v1: 14, or 70 when it finishes the day). */
  burst?: number;
}) {
  if (variant === "task")
    return (
      <label className={cx(TASK_ROW, disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
        <input
          type="checkbox"
          className={TASK_BOX}
          checked={checked}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.checked);
            if (e.target.checked && pieces) burstFrom(e.currentTarget, pieces);
          }}
        />
        <span className={cx("grid gap-0.5", TASK_TEXT)}>
          <span>{txt(label)}</span>
          {description && <span className="text-[0.85rem] text-gray">{txt(description)}</span>}
        </span>
      </label>
    );
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

/** One round radio button on its own, for a row you lay out yourself (e.g. "this option is right" beside each
 *  option of a question being edited). Radios sharing a `name` form a group; `label` is read aloud only. */
export function Radio({
  name,
  checked,
  onChange,
  label,
  disabled,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="radio"
      className={cx(RADIO, "mt-0", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}
      name={name}
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={onChange}
    />
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
