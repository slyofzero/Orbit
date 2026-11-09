"use client";
import { useMemo } from "react";
import { findQuestion } from "@/lib/bank";
import { Ev, buildEvents } from "@/lib/stats";
import { KEYS, usePack, usePersisted, usePlan } from "@/lib/store";
import type { Links } from "@/lib/links";
import { Attempt, LogEntry, PracticeRec } from "@/lib/types";

/** Everything the statistics screens need, loaded once. */
export function useStats() {
  const { pack, byId, topicById, subjects, ready: r0 } = usePack();
  const [log, , r1] = usePersisted<LogEntry[]>(KEYS.plog, []);
  const [practice, , r2] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [attempts, , r3] = usePersisted<Attempt[]>(KEYS.attempts, []);
  const [views, , r4] = usePersisted<{ q: string; at: number }[]>(KEYS.views, []);
  const { plan, custom: hasPlan, ready: r5 } = usePlan();
  const [done, , r6] = usePersisted<Record<string, boolean>>(KEYS.done, {});
  const [links, , r7] = usePersisted<Links>(KEYS.links, {});
  const evs: Ev[] = useMemo(() => buildEvents({ log, practice, attempts, pack, views, find: (id) => findQuestion(pack, byId, id) }), [log, practice, attempts, views, pack, byId]);
  return { ready: r0 && r1 && r2 && r3 && r4 && r5 && r6 && r7, pack, topicById, subjects, evs, attempts, views, plan: hasPlan ? plan : null, done, links };
}

/** Plain text for a tile or row: maths and code markers stripped, shortened. */
export const plain = (s: string, n = 90) => { const t = s.replace(/!\[([^\]\n]*)\]\([^)\s]+\)/g, " [picture] ").replace(/```[\s\S]*?```/g, " [code] ").replace(/\$+/g, "").replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
