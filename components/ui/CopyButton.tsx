"use client";
// Copies text to the clipboard. On success the icon turns into a ✓ (and the label into "Copied!")
// for a moment; if the browser refuses, it shows ✗ and "Couldn't copy" instead.

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconX } from "./icons";
import { cx } from "./cx";
import { BUTTON_BASE, BUTTON_SIZE, BUTTON_VARIANT, iconButtonClass } from "./Button";
import { txt } from "./txt";

type State = "idle" | "copied" | "failed";
const SHOW_MS = 1600;

/** Copies `text`; uses the Clipboard API, falling back to the old copy command where it is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the fallback */
  }
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
export function CopyButton({
  text,
  label,
  copiedLabel = "Copied!",
  size = "md",
  variant = "soft",
  onCopied,
}: {
  text: string | (() => string);
  label?: string;
  copiedLabel?: string;
  size?: "sm" | "md";
  variant?: "soft" | "ghost" | "primary";
  onCopied?: () => void;
}) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const click = async () => {
    const ok = await copyText(typeof text === "function" ? text() : text);
    setState(ok ? "copied" : "failed");
    if (ok) onCopied?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), SHOW_MS);
  };

  const icon =
    state === "copied" ? <IconCheck key="ok" /> : state === "failed" ? <IconX key="no" /> : <IconCopy key="copy" />;
  const said = state === "copied" ? copiedLabel : state === "failed" ? "Couldn't copy" : (label ?? "Copy");

  // colours: the variant's while idle; green once copied, red if the browser refused
  const colours =
    state === "copied"
      ? variant === "primary"
        ? "bg-green text-white"
        : "border-green bg-sheet text-green"
      : state === "failed"
        ? "border-red bg-sheet text-red"
        : label
          ? BUTTON_VARIANT[variant]
          : variant === "ghost"
            ? "border-transparent bg-transparent text-ink enabled:hover:bg-sheet-2"
            : "border-line bg-sheet text-ink enabled:hover:border-ink";

  return (
    <button
      type="button"
      onClick={click}
      title={label ? undefined : said}
      aria-label={label ? undefined : said}
      className={cx(label ? cx(BUTTON_BASE, BUTTON_SIZE[size]) : iconButtonClass("md", "outline", false), colours)}
    >
      <span className="inline-grid place-items-center [&_svg]:animate-copy-pop" aria-hidden="true">
        {icon}
      </span>
      {label && <span>{txt(said)}</span>}
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Could not copy" : ""}
      </span>
    </button>
  );
}
