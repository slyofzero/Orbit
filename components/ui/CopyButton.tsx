"use client";
// Copies text to the clipboard. On success the icon turns into a ✓ (and the label into "Copied!")
// for a moment; if the browser refuses, it shows ✗ and "Couldn't copy" instead.

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconX } from "./icons";
import { cx } from "./cx";
import { txt } from "./txt";

type State = "idle" | "copied" | "failed";
const SHOW_MS = 1600;

/** Copies `text`; uses the Clipboard API, falling back to the old copy command where it is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through to the fallback */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** `text` may be a function, so large text is only built when clicked.
 *  Without `label` it is a round icon button; with `label` it is a normal button with text. */
export function CopyButton({ text, label, copiedLabel = "Copied!", size = "md", variant = "soft", onCopied }: {
  text: string | (() => string);
  label?: string;
  copiedLabel?: string;
  size?: "sm" | "md";
  variant?: "soft" | "ghost" | "primary";
  onCopied?: () => void;
}) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const click = async () => {
    const ok = await copyText(typeof text === "function" ? text() : text);
    setState(ok ? "copied" : "failed");
    if (ok) onCopied?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), SHOW_MS);
  };

  const icon = state === "copied" ? <IconCheck key="ok" /> : state === "failed" ? <IconX key="no" /> : <IconCopy key="copy" />;
  const said = state === "copied" ? copiedLabel : state === "failed" ? "Couldn't copy" : label ?? "Copy";

  return (
    <button type="button" onClick={click} title={label ? undefined : said} aria-label={label ? undefined : said}
      className={cx("ui-copy", label ? `ui-btn ui-btn-${variant} ui-btn-${size}` : "ui-iconbtn", state !== "idle" && `is-${state}`)}>
      <span className="ui-copy-icon" aria-hidden="true">{icon}</span>
      {label && <span>{txt(said)}</span>}
      <span className="ui-sr" aria-live="polite">{state === "copied" ? "Copied to clipboard" : state === "failed" ? "Could not copy" : ""}</span>
    </button>
  );
}
