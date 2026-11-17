"use client";
import type { ReactNode } from "react";
import { txt } from "./txt";

/** On/off setting that applies immediately (use Checkbox inside forms that are submitted). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="group inline-flex cursor-pointer items-center gap-2.5 text-left text-ink disabled:cursor-not-allowed disabled:opacity-50"
      onClick={() => onChange(!checked)}
    >
      <span className="relative h-6 w-[42px] shrink-0 rounded-full bg-line transition-colors duration-150 group-aria-checked:bg-accent after:absolute after:top-[3px] after:left-[3px] after:size-[18px] after:rounded-full after:bg-sheet after:shadow-[0_1px_3px_rgba(0,0,0,0.3)] after:transition-transform after:duration-150 after:content-[''] group-aria-checked:after:translate-x-[18px]" />
      <span>{txt(label)}</span>
    </button>
  );
}
