"use client";
import { useEffect, useState } from "react";

// After 9 AM (IST) today's plan is locked: no editing today's tasks, no unlinking today's questions. Ticking tasks and solving questions still work.
export const LOCK_HOUR = 9;
export const LOCK_MESSAGE = "Today is locked after 9 AM, so its tasks and linked questions can't be changed. You can still tick tasks and solve questions. Tomorrow and later days stay editable.";

const TZ = "Asia/Kolkata";
const istDate = (now: Date) => now.toLocaleDateString("en-CA", { timeZone: TZ });
const istHour = (now: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(now)) % 24;

export const isDayLocked = (date: string, now: Date = new Date()): boolean => date === istDate(now) && istHour(now) >= LOCK_HOUR;

type L = Record<string, { q: string[]; mock?: string; note?: string }>;
/** Links with every locked day's entry taken from `current` (so a bulk change can't touch it). */
export const keepLockedLinks = <T extends L>(next: T, current: T): T => {
  const out = { ...next } as L;
  for (const [d, v] of Object.entries(current)) if (isDayLocked(d)) out[d] = v;
  for (const d of Object.keys(out)) if (isDayLocked(d) && !(d in current)) delete out[d];
  return out as T;
};

/** Re-renders every 30 seconds so the lock appears at 9 AM without a refresh. Returns the current time. */
export function useLockClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return now;
}
