"use client";
import type { ReactNode } from "react";
import { txt } from "./txt";

/** On/off setting that applies immediately (use Checkbox inside forms that are submitted). */
export function Switch({ checked, onChange, label, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} className="ui-switch"
      onClick={() => onChange(!checked)}>
      <span className="ui-switch-track" />
      <span>{txt(label)}</span>
    </button>
  );
}
