// The hand-written GATE DA question bank. Not loaded by the app: `bun run export` turns it into the pack JSON you upload.
import { Question } from "./types";
import { TOPIC_BY_ID } from "./topics";
import { PS } from "./questions/ps";
import { LA } from "./questions/la";
import { CALC } from "./questions/calc";
import { DSA } from "./questions/dsa";
import { DBMS } from "./questions/dbms";
import { ML } from "./questions/ml";
import { AI } from "./questions/ai";
import { GA } from "./questions/ga";
import { QBody } from "./questions/helpers";

// IDs are "<topic>-<n>" in definition order. Append new questions at the END of a file so ids stay stable.
const counters: Record<string, number> = {};
function assign(list: QBody[]): Question[] {
  return list.map((q) => {
    counters[q.topic] = (counters[q.topic] ?? 0) + 1;
    if (!TOPIC_BY_ID[q.topic]) throw new Error(`Unknown topic id: ${q.topic}`);
    return { ...q, id: `${q.topic}-${counters[q.topic]}` };
  });
}

export const BANK: Question[] = [PS, LA, CALC, DSA, DBMS, ML, AI, GA].flatMap(assign);
