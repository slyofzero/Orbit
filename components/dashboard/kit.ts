"use client";
// Shared bits of the dashboard's sections: v1's panel look, the day-kind colours and labels, and the
// temporary "coming next" toast for buttons whose action isn't built yet.

import { useToast, type CalendarTone, type PillTone } from "@/components/ui";
import type { PlanDayKind } from "@/types/tables";

/** v1's dashboard panel: a Card with rounder corners and a shadow that lifts a little on hover. */
export const PANEL = "rounded-[22px] shadow-card transition-transform duration-200 hover:-translate-y-0.5";

export const KIND_LABEL: Record<PlanDayKind, string> = {
  study: "study",
  light: "light",
  mock: "mock",
  crunch: "short day",
  buffer: "buffer",
  exam: "exam",
  taper: "taper",
};
export const KIND_PILL: Record<PlanDayKind, PillTone> = {
  study: "blue",
  light: "green",
  mock: "accent-solid",
  crunch: "amber",
  buffer: "neutral",
  exam: "red-solid",
  taper: "hi",
};
export const KIND_TINT: Record<PlanDayKind, CalendarTone> = {
  study: "blue",
  light: "green",
  mock: "accent",
  crunch: "amber",
  buffer: "neutral",
  exam: "red",
  taper: "hi",
};
/** The calendar's key (v1 lists these five). */
export const KIND_LEGEND: { tone: CalendarTone; label: string }[] = [
  { tone: "blue", label: "study" },
  { tone: "amber", label: "short day" },
  { tone: "green", label: "light" },
  { tone: "accent", label: "mock" },
  { tone: "red", label: "exam" },
];

// TODO(functionality pass): every useSoon() call is a button whose action isn't built yet. Grep for it.
/** A click handler that says the action is coming in the next step. */
export function useSoon() {
  const toast = useToast();
  return (what: string) => () => toast(`${what}: coming in the next step.`);
}
