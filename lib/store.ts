"use client";
import { loadImages, saveImages } from "./imageStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogEntry, Settings } from "./types";
import { useMemo } from "react";
import { EMPTY_PLAN, Milestone, PlanData } from "./plan";
import { EMPTY_PACK, PackData } from "./packs";
import { scope } from "./profiles";

export const KEYS = {
  settings: "gate.settings",
  done: "gate.done", // Record<"date:idx", true>
  practice: "gate.practice", // Record<qid, PracticeRec>
  extra: "gate.extra", // Record<topic, seed[]>  (generated practice questions)
  attempts: "gate.attempts", // Attempt[]
  fixed: "gate.fixed", // Record<qid, true>  (mistakes you have re-solved)
  milestones: "gate.milestones", // Milestone[] (null until you edit the defaults)
  quotes: "gate.quotes", // { seen: number[]; last: number }
  plan: "gate.plan", // PlanData (null = no plan yet)
  pack: "gate.pack", // PackData (null = no question pack yet)
  plog: "gate.plog", // LogEntry[]  (every practice answer / skip, for statistics)
  drafts: "gate.drafts", // Record<qid, code you were writing>  (programming questions)
  views: "gate.views", // {q, at}[]  (every time a practice question was on screen; skips = views minus answers)
  bonusOff: "gate.bonusOff", // Record<key, true>  (bonus tasks/questions the person unlinked from the day they were carried to)
  links: "gate.links", // Record<date, {q, mock?, note?}>  (which questions go with which plan day)
  party: "gate.party", // {date, at} | null  (when today's last planned task was ticked: the study buddies party for 15 minutes)
} as const;

const LOG_MAX = 20000;
/** Adds one entry to the practice log (works from anywhere, no hook needed). */
export function logPractice(e: LogEntry) {
  const key = scope(KEYS.plog);
  try {
    const list = JSON.parse(localStorage.getItem(key) ?? "[]") as LogEntry[];
    list.push(e);
    localStorage.setItem(key, JSON.stringify(list.length > LOG_MAX ? list.slice(-LOG_MAX) : list));
    window.dispatchEvent(new CustomEvent("gate-store", { detail: key }));
  } catch { /* storage full or blocked */ }
}

/** Records that a practice question was looked at. A skip is never recorded: skips are worked out later as views minus answers. */
export function logView(q: string) {
  const key = scope(KEYS.views);
  try {
    const list = JSON.parse(localStorage.getItem(key) ?? "[]") as { q: string; at: number }[];
    list.push({ q, at: Date.now() });
    localStorage.setItem(key, JSON.stringify(list.length > LOG_MAX ? list.slice(-LOG_MAX) : list));
    window.dispatchEvent(new CustomEvent("gate-store", { detail: key }));
  } catch { /* storage full or blocked */ }
}

export const DEFAULT_SETTINGS: Settings = { name: "", examDate: "" };

// localStorage-backed state that stays in sync between components. `ready` is false until the first read.
export function usePersisted<T>(rawKey: string, initial: T): [T, (u: T | ((p: T) => T)) => void, boolean] {
  const key = scope(rawKey); // each profile reads and writes its own copy
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

// The backup holds everything this profile keeps, including the pictures that its pack and its mock attempts use.
export async function exportAll(): Promise<string> {
  const out: Record<string, unknown> = {};
  for (const k of Object.values(KEYS)) {
    const s = localStorage.getItem(scope(k));
    if (s) out[k] = JSON.parse(s);
  }
  try { const t = localStorage.getItem("gate.theme"); if (t) out.theme = t; } catch { /* no theme saved */ }
  out._backup = { app: "orbit", version: 2, exportedAt: new Date().toISOString() };
  const names = [...new Set([...JSON.stringify(out).matchAll(/img:(h[0-9a-z]+-[0-9a-z]+)/g)].map((m) => m[1]))];
  const images = names.length ? await loadImages(names) : {};
  if (Object.keys(images).length) out.images = images;
  return JSON.stringify(out, null, 2);
}

// Wipes everything the current profile keeps in the browser (plan, pack, ticks, practice, mocks, milestones, name) and reloads.
export function clearAll() {
  for (const k of Object.values(KEYS)) localStorage.removeItem(scope(k));
  try { indexedDB.deleteDatabase(scope("images")); } catch { /* no pictures to remove */ }
  window.location.reload();
}

/** Reads a backup file's text and says what is in it, without changing anything. */
export function inspectBackup(json: string): { ok: true; keys: number; when?: string } | { ok: false; error: string } {
  try {
    const d = JSON.parse(json);
    if (typeof d !== "object" || d === null || Array.isArray(d)) return { ok: false, error: "This is not a progress backup. It must be a file made by Export progress." };
    const keys = Object.values(KEYS).filter((k) => k in d).length;
    if (keys === 0) return { ok: false, error: "This file has none of the things a backup holds (plan, pack, practice, mocks). It is not a progress backup." };
    return { ok: true, keys, when: typeof d._backup?.exportedAt === "string" ? d._backup.exportedAt : undefined };
  } catch (e) { return { ok: false, error: `This is not valid JSON: ${(e as Error).message}` }; }
}

// Restores a backup so the profile looks exactly as it did when exported: what the backup lacks is cleared, not kept.
export async function importAll(json: string) {
  const data = JSON.parse(json) as Record<string, unknown>;
  if (data.images && typeof data.images === "object") await saveImages(data.images as Record<string, string>);
  for (const k of Object.values(KEYS)) {
    if (k in data) localStorage.setItem(scope(k), JSON.stringify(data[k]));
    else localStorage.removeItem(scope(k));
  }
  if (typeof data.theme === "string") { try { localStorage.setItem("gate.theme", data.theme); } catch { /* ignore */ } }
  window.location.reload();
}

// Your milestones. Until you change them you get the defaults; after that your own list is kept (sorted by date).
export function useMilestones() {
  const [stored, setStored, r2] = usePersisted<Milestone[] | null>(KEYS.milestones, null);
  const { plan, ready: r1 } = usePlan();
  const list = [...(stored ?? plan.milestones)].sort((a, b) => a.date.localeCompare(b.date));
  const save = (next: Milestone[]) => setStored([...next].sort((a, b) => a.date.localeCompare(b.date)));
  return {
    milestones: list,
    ready: r1 && r2,
    add: (m: Omit<Milestone, "id" | "short">) => save([...list, { ...m, id: `m${Date.now().toString(36)}`, short: m.name }]),
    update: (id: string, patch: Partial<Milestone>) => save(list.map((x) => (x.id === id ? { ...x, ...patch, short: patch.name ?? x.short } : x))),
    remove: (id: string) => save(list.filter((x) => x.id !== id)),
    restore: (all: Milestone[]) => save(all),
    reset: () => setStored(null),
  };
}

// The plan you follow. Nothing is built in: it stays empty until you upload one (components/PlanImport.tsx).
export function usePlan() {
  const [stored, setStored, ready] = usePersisted<PlanData | null>(KEYS.plan, null);
  const [, setMs] = usePersisted<Milestone[] | null>(KEYS.milestones, null);
  const [, setDone] = usePersisted<Record<string, boolean>>(KEYS.done, {});
  const [, setLinks] = usePersisted<Record<string, unknown>>(KEYS.links, {});
  const plan = stored ?? EMPTY_PLAN;
  return {
    plan,
    days: plan.days,
    custom: stored !== null,
    ready,
    // swap in a new plan; your milestones restart from the plan's own, and ticks are cleared unless you keep them
    install: (next: PlanData, keepTicks: boolean, links: Record<string, unknown> = {}) => {
      setStored(next);
      setMs(null);
      setLinks(links);
      if (!keepTicks) setDone({});
    },
    // small edits: keeps milestones, ticks and links as they are
    update: (next: PlanData) => setStored(next),
    remove: () => {
      setStored(null);
      setMs(null);
      setLinks({});
      setDone({});
    },
  };
}

// The question pack: topics, questions and mock recipes. Empty until you upload one (components/PackImport.tsx).
export function usePack() {
  const [stored, setStored, ready] = usePersisted<PackData | null>(KEYS.pack, null);
  const [, setPractice] = usePersisted<Record<string, unknown>>(KEYS.practice, {});
  const [, setExtra] = usePersisted<Record<string, unknown>>(KEYS.extra, {});
  const [, setFixed] = usePersisted<Record<string, unknown>>(KEYS.fixed, {});
  const pack = useMemo(() => (stored ? { ...stored, mockTests: stored.mockTests ?? [] } : EMPTY_PACK), [stored]);
  const derived = useMemo(() => ({
    topicById: Object.fromEntries(pack.topics.map((t) => [t.id, t])) as Record<string, PackData["topics"][number]>,
    byId: new Map([...pack.questions, ...pack.mockTests.flatMap((m) => m.sections.flatMap((x) => x.questions))].map((q) => [q.id, q])),
  }), [pack]);
  const [, setLog] = usePersisted<unknown[]>(KEYS.plog, []);
  const [, setViews] = usePersisted<unknown[]>(KEYS.views, []);
  const clearHistory = () => { setPractice({}); setExtra({}); setFixed({}); setLog([]); setViews([]); };
  return {
    pack,
    ...derived,
    subjects: pack.subjects,
    custom: stored !== null,
    ready,
    install: async (next: PackData, keepHistory: boolean, images?: Record<string, string>) => { if (images) await saveImages(images); setStored(next); if (!keepHistory) clearHistory(); },
    remove: () => { setStored(null); clearHistory(); },
  };
}
