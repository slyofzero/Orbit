"use client";
import { useMemo } from "react";
import { findQuestion } from "@/lib/bank";
import { Ev, buildEvents } from "@/lib/stats";
import { KEYS, usePack, usePersisted } from "@/lib/store";
import { Attempt, LogEntry, PracticeRec } from "@/lib/types";

/** Everything the statistics screens need, loaded once. */
export function useStats() {
  const { pack, byId, topicById, subjects, ready: r0 } = usePack();
  const [log, , r1] = usePersisted<LogEntry[]>(KEYS.plog, []);
  const [practice, , r2] = usePersisted<Record<string, PracticeRec>>(KEYS.practice, {});
  const [attempts, , r3] = usePersisted<Attempt[]>(KEYS.attempts, []);
  const evs: Ev[] = useMemo(() => buildEvents({ log, practice, attempts, pack, find: (id) => findQuestion(pack, byId, id) }), [log, practice, attempts, pack, byId]);
  return { ready: r0 && r1 && r2 && r3, pack, topicById, subjects, evs, attempts };
}

/** Plain text for a tile or row: maths and code markers stripped, shortened. */
export const plain = (s: string, n = 90) => { const t = s.replace(/!\[([^\]\n]*)\]\([^)\s]+\)/g, " [picture] ").replace(/```[\s\S]*?```/g, " [code] ").replace(/\$+/g, "").replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
