"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Settings } from "./types";
import { Milestone, milestonesFor } from "./plan";

export const KEYS = {
  settings: "gate.settings",
  done: "gate.done", // Record<"date:idx", true>
  practice: "gate.practice", // Record<qid, PracticeRec>
  extra: "gate.extra", // Record<topic, seed[]>  (generated practice questions)
  attempts: "gate.attempts", // Attempt[]
  fixed: "gate.fixed", // Record<qid, true>  (mistakes you have re-solved)
  milestones: "gate.milestones", // Milestone[] (null until you edit the defaults)
  quotes: "gate.quotes", // { seen: number[]; last: number }
} as const;

export const DEFAULT_SETTINGS: Settings = { name: "Ishan", examDate: "2027-02-07" };

// localStorage-backed state that stays in sync between components. `ready` is false until the first read.
export function usePersisted<T>(key: string, initial: T): [T, (u: T | ((p: T) => T)) => void, boolean] {
  const [val, setVal] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const ref = useRef<T>(initial);

  useEffect(() => {
    const read = () => {
      try {
        const s = localStorage.getItem(key);
        if (s !== null && s !== JSON.stringify(ref.current)) {
          ref.current = JSON.parse(s) as T;
          setVal(ref.current);
        }
      } catch {
        /* ignore corrupt data */
      }
    };
    read();
    setReady(true);
    const h = (e: Event) => {
      if ((e as CustomEvent).detail === key) read();
    };
    const st = (e: StorageEvent) => {
      if (e.key === key) read();
    };
    window.addEventListener("gate-store", h);
    window.addEventListener("storage", st);
    return () => {
      window.removeEventListener("gate-store", h);
      window.removeEventListener("storage", st);
    };
  }, [key]);

  const set = useCallback(
    (u: T | ((p: T) => T)) => {
      const next = typeof u === "function" ? (u as (p: T) => T)(ref.current) : u;
      ref.current = next;
      setVal(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage full or blocked */
      }
      window.dispatchEvent(new CustomEvent("gate-store", { detail: key }));
    },
    [key]
  );

  return [val, set, ready];
}

export function exportAll(): string {
  const out: Record<string, unknown> = {};
  for (const k of Object.values(KEYS)) {
    const s = localStorage.getItem(k);
    if (s) out[k] = JSON.parse(s);
  }
  return JSON.stringify(out, null, 2);
}

export function importAll(json: string) {
  const data = JSON.parse(json) as Record<string, unknown>;
  for (const k of Object.values(KEYS)) if (k in data) localStorage.setItem(k, JSON.stringify(data[k]));
  window.location.reload();
}

// Your milestones. Until you change them you get the defaults; after that your own list is kept (sorted by date).
export function useMilestones() {
  const [stored, setStored, r2] = usePersisted<Milestone[] | null>(KEYS.milestones, null);
  const list = [...(stored ?? milestonesFor())].sort((a, b) => a.date.localeCompare(b.date));
  const save = (next: Milestone[]) => setStored([...next].sort((a, b) => a.date.localeCompare(b.date)));
  return {
    milestones: list,
    ready: r2,
    add: (m: Omit<Milestone, "id" | "short">) => save([...list, { ...m, id: `m${Date.now().toString(36)}`, short: m.name }]),
    update: (id: string, patch: Partial<Milestone>) => save(list.map((x) => (x.id === id ? { ...x, ...patch, short: patch.name ?? x.short } : x))),
    remove: (id: string) => save(list.filter((x) => x.id !== id)),
    restore: (all: Milestone[]) => save(all),
    reset: () => setStored(null),
  };
}
