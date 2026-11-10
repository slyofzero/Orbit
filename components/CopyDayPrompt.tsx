"use client";
import { useEffect, useRef, useState } from "react";
import { dayHelpPrompt } from "@/lib/dayPrompt";
import { KEYS, usePack, usePersisted, usePlan } from "@/lib/store";
import type { Links } from "@/lib/links";
import type { Day } from "@/lib/types";
import CopyIcon from "@/components/CopyIcon";

// "Copy" button: puts a ready-made prompt for this plan day on the clipboard, to paste into any AI chat.
export default function CopyDayPrompt({ day }: { day: Day; icon?: boolean }) {
  const { pack } = usePack();
  const { plan } = usePlan();
  const [links] = usePersisted<Links>(KEYS.links, {});
  const [state, setState] = useState<"idle" | "done" | "blocked">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    const text = dayHelpPrompt(day, pack, links[day.date], plan.name, plan.milestones, plan.description);
    try { await navigator.clipboard.writeText(text); setState("done"); } catch { setState("blocked"); }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2500);
  };
  const tip = state === "done" ? "Copied" : state === "blocked" ? "Copy blocked" : "Copy AI prompt";
  return (
    <button className="btn soft icon-btn" onClick={copy} title={state === "idle" ? "Copy a prompt that asks any AI how to get through this day" : tip} aria-label="Copy AI prompt for this day" aria-live="polite">
      <CopyIcon done={state === "done"} />
    </button>
  );
}
