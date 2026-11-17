// Applies one Edit (lib/editing.ts) to a <textarea> as a NATIVE change, so Ctrl+Z undoes it.
// Falls back to setting the value through onChange if the browser refuses.

import { applyEdit, type Edit } from "@/lib/editing";

export function applyToTextarea(el: HTMLTextAreaElement | null, value: string, onChange: (v: string) => void, e: Edit) {
  if (!el) { onChange(applyEdit(value, e)); return; }
  el.focus();
  el.setSelectionRange(e.from, e.to);
  let ok = false;
  try { ok = document.execCommand(e.insert ? "insertText" : "delete", false, e.insert); } catch { ok = false; }
  if (!ok) onChange(applyEdit(value, e));
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(e.selStart, e.selEnd); });
}
